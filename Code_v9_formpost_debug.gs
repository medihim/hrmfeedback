/**
 * 한상훈 KPI 의견 수렴 Web App v9
 * - HTML 제출 누락 진단을 위해 수신 요청 로그를 별도 기록
 * - fetch/no-cors, sendBeacon, form POST 모두 처리 가능
 * - castingn.com 수신자만 사용
 */
const CONFIG = {
  VERSION: 'v9-formpost-debug-20260720',
  SHEET_NAME: '한상훈_KPI_의견',
  MAIL_LOG_SHEET: '메일발송로그',
  REQUEST_LOG_SHEET: '수신요청로그',
  SUBMIT_TOKEN: '3370',
  SPREADSHEET_ID: '', // Google Sheet에 바인딩된 Apps Script면 비워둡니다.
  RECIPIENTS: [
    'ksbae@castingn.com',
    'jaykim@castingn.com',
    'snyong@castingn.com'
  ]
};

function doGet(e) {
  return ContentService
    .createTextOutput([
      'Medihim KPI Feedback endpoint is running.',
      'version: ' + CONFIG.VERSION,
      'recipients: ' + CONFIG.RECIPIENTS.join(', '),
      'sheet: ' + CONFIG.SHEET_NAME,
      'mailLogSheet: ' + CONFIG.MAIL_LOG_SHEET,
      'requestLogSheet: ' + CONFIG.REQUEST_LOG_SHEET
    ].join('\n'))
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const receivedAt = new Date();
  let raw = '';
  let contentType = '';
  let payloadText = '';
  let data = {};

  try {
    contentType = e && e.postData && e.postData.type ? e.postData.type : '';
    raw = e && e.postData && e.postData.contents ? e.postData.contents : '';

    // form POST 방식: payload 필드 사용
    if (e && e.parameter && e.parameter.payload) {
      payloadText = e.parameter.payload;
    } else {
      payloadText = raw;
    }

    // URL encoded form에서 payload가 아닌 개별 필드로 온 경우 대비
    if (!payloadText && e && e.parameter) {
      data = Object.assign({}, e.parameter);
    } else {
      data = JSON.parse(payloadText || '{}');
    }

    logRequest_(receivedAt, 'RECEIVED', contentType, raw, data, 'request received');

    if (data.token !== CONFIG.SUBMIT_TOKEN) {
      logRequest_(receivedAt, 'INVALID_TOKEN', contentType, raw, data, 'Invalid token: ' + (data.token || ''));
      return response_({ ok: false, message: 'Invalid token' });
    }

    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (rows.length === 0) {
      logRequest_(receivedAt, 'NO_ROWS', contentType, raw, data, 'No rows in payload');
      return response_({ ok: false, message: 'No rows in payload' });
    }

    const ss = getSpreadsheet_();
    const sheet = ensureOpinionSheet_(ss);
    const submissionId = data.submissionId || Utilities.getUuid();

    const existingIds = getExistingSubmissionIds_(sheet);
    if (existingIds[submissionId]) {
      logRequest_(receivedAt, 'DUPLICATE', contentType, raw, data, 'Duplicate submissionId: ' + submissionId);
      return response_({ ok: true, message: 'duplicate ignored', submissionId: submissionId });
    }

    rows.forEach(function(row) {
      sheet.appendRow([
        receivedAt,
        submissionId,
        data.documentTitle || '한상훈 3개월 KPI Draft Review',
        row['작성자'] || '',
        row['작성일'] || '',
        row['의견유형'] || '',
        row['관련KPI'] || '',
        row['관련월차'] || '',
        row['우선순위'] || '',
        row['질문건의'] || '',
        row['수행가능범위리스크'] || '',
        row['수정제안지원사항'] || '',
        data.submittedAt || '',
        JSON.stringify(row)
      ]);
    });

    sendNotificationEmail_(data, rows, receivedAt, submissionId);
    logRequest_(receivedAt, 'SAVED', contentType, raw, data, 'Saved rows: ' + rows.length + ', submissionId: ' + submissionId);

    return response_({ ok: true, message: 'submitted', count: rows.length, submissionId: submissionId });

  } catch (error) {
    try {
      logRequest_(receivedAt, 'ERROR', contentType, raw, data, error && error.stack ? error.stack : String(error));
    } catch (logError) {}
    return response_({ ok: false, message: error.message || String(error) });
  }
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Active Spreadsheet를 찾을 수 없습니다. Google Sheet에서 Apps Script를 열었는지 확인하거나 SPREADSHEET_ID를 입력해 주세요.');
  return ss;
}

function ensureOpinionSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '제출일시','제출ID','문서명','작성자','작성일','의견유형','관련 KPI','관련 월차','우선순위',
      '질문/건의','수행 가능 범위/리스크','수정 제안/지원 요청','브라우저 제출시각','원본 JSON'
    ]);
  }
  return sheet;
}

function ensureRequestLogSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG.REQUEST_LOG_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.REQUEST_LOG_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['로그일시','상태','Content-Type','제출ID','Rows','메시지','Raw Body','Parsed JSON']);
  }
  return sheet;
}

function ensureMailLogSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG.MAIL_LOG_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.MAIL_LOG_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['로그일시','제출ID','수신자','상태','메시지','제목','남은 일일 발송 가능량']);
  }
  return sheet;
}

function logRequest_(time, status, contentType, raw, data, message) {
  const ss = getSpreadsheet_();
  const sheet = ensureRequestLogSheet_(ss);
  const rows = data && Array.isArray(data.rows) ? data.rows.length : '';
  const submissionId = data && data.submissionId ? data.submissionId : '';
  sheet.appendRow([
    time,
    status,
    contentType || '',
    submissionId,
    rows,
    message || '',
    truncate_(raw || '', 4000),
    truncate_(JSON.stringify(data || {}), 4000)
  ]);
}

function truncate_(text, maxLen) {
  text = String(text || '');
  return text.length > maxLen ? text.slice(0, maxLen) + '...[truncated]' : text;
}

function getExistingSubmissionIds_(sheet) {
  const map = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  values.forEach(function(row) {
    if (row[0]) map[String(row[0])] = true;
  });
  return map;
}

function sendNotificationEmail_(data, rows, submittedAt, submissionId) {
  const ss = getSpreadsheet_();
  const logSheet = ensureMailLogSheet_(ss);
  const recipients = CONFIG.RECIPIENTS.filter(function(email) { return email && email.indexOf('@') > -1; });
  const subject = '[메디힘] 한상훈 KPI 의견이 제출되었습니다';
  const body = buildEmailBody_(data, rows, submittedAt, submissionId);

  recipients.forEach(function(email) {
    try {
      MailApp.sendEmail({ to: email, subject: subject, body: body });
      logSheet.appendRow([new Date(), submissionId, email, 'SENT', '메일 발송 성공', subject, MailApp.getRemainingDailyQuota()]);
    } catch (err) {
      logSheet.appendRow([new Date(), submissionId, email, 'FAILED', err.message || String(err), subject, MailApp.getRemainingDailyQuota()]);
    }
  });
}

function buildEmailBody_(data, rows, submittedAt, submissionId) {
  const lines = [];
  lines.push('한상훈 KPI 의견이 제출되었습니다.');
  lines.push('');
  lines.push('제출ID: ' + submissionId);
  lines.push('제출일시: ' + submittedAt);
  lines.push('문서명: ' + (data.documentTitle || '한상훈 3개월 KPI Draft Review'));
  lines.push('브라우저 제출시각: ' + (data.submittedAt || ''));
  lines.push('제출 의견 수: ' + rows.length + '건');
  lines.push('');
  lines.push('----------------------------------------');
  lines.push('제출 의견 요약');
  lines.push('----------------------------------------');
  rows.forEach(function(row, index) {
    lines.push('');
    lines.push('[' + (index + 1) + ']');
    lines.push('작성자: ' + (row['작성자'] || ''));
    lines.push('작성일: ' + (row['작성일'] || ''));
    lines.push('의견유형: ' + (row['의견유형'] || ''));
    lines.push('관련 KPI: ' + (row['관련KPI'] || ''));
    lines.push('관련 월차: ' + (row['관련월차'] || ''));
    lines.push('우선순위: ' + (row['우선순위'] || ''));
    lines.push('');
    lines.push('[질문/건의]');
    lines.push(row['질문건의'] || '');
    lines.push('');
    lines.push('[수행 가능 범위/리스크]');
    lines.push(row['수행가능범위리스크'] || '');
    lines.push('');
    lines.push('[수정 제안/지원 요청]');
    lines.push(row['수정제안지원사항'] || '');
    lines.push('');
    lines.push('----------------------------------------');
  });
  lines.push('');
  lines.push('※ 상세 원본 데이터는 Google Sheet의 "' + CONFIG.SHEET_NAME + '" 시트를 확인해 주세요.');
  return lines.join('\n');
}

function response_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function authorizeOnce() {
  const ss = getSpreadsheet_();
  ensureOpinionSheet_(ss);
  ensureMailLogSheet_(ss);
  ensureRequestLogSheet_(ss);
  MailApp.getRemainingDailyQuota();
  Logger.log('Authorization completed: ' + ss.getName() + ' / ' + CONFIG.VERSION);
}

function testEmailOnly() {
  const data = {
    token: CONFIG.SUBMIT_TOKEN,
    documentTitle: '한상훈 3개월 KPI Draft Review',
    submittedAt: new Date().toISOString(),
    rows: [{
      '작성자': '시스템 테스트',
      '작성일': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      '의견유형': '테스트',
      '관련KPI': '메일 발송 테스트',
      '관련월차': '공통',
      '우선순위': '보통',
      '질문건의': 'v9 메일 단독 테스트입니다.',
      '수행가능범위리스크': '메일 수신 확인용입니다.',
      '수정제안지원사항': '테스트 후 삭제 가능합니다.'
    }]
  };
  sendNotificationEmail_(data, data.rows, new Date(), 'email-test-' + Utilities.getUuid());
}

function testPost() {
  const fakeEvent = {
    postData: {
      type: 'text/plain',
      contents: JSON.stringify({
        token: CONFIG.SUBMIT_TOKEN,
        submissionId: 'testpost-' + Utilities.getUuid(),
        submittedAt: new Date().toISOString(),
        documentTitle: '한상훈 3개월 KPI Draft Review',
        rows: [{
          '작성자': '시스템 테스트',
          '작성일': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          '의견유형': '테스트',
          '관련KPI': 'Apps Script doPost 테스트',
          '관련월차': '공통',
          '우선순위': '보통',
          '질문건의': 'v9 doPost 자체 테스트입니다.',
          '수행가능범위리스크': 'Sheet 저장 및 메일 발송 확인용입니다.',
          '수정제안지원사항': '테스트 후 삭제 가능합니다.'
        }]
      })
    },
    parameter: {}
  };
  return doPost(fakeEvent);
}
