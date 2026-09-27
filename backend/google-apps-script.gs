/**
 * Krystal 書頁工作室：Google 試算表後台
 * ------------------------------------------------------------------
 * 這段程式貼到 Google 試算表的「擴充功能 → Apps Script」裡。
 * 部署成網頁應用程式後，網站會：
 *   1. 把案主送出的委託寫進「委託」分頁，並寄信通知你
 *   2. 從「檔期」分頁讀取案子，顯示在網站行事曆上
 *
 * 「委託」分頁含案主個資，只有你看得到；網站只讀得到「檔期」分頁的公開欄位。
 * 完整設定步驟見 README.md 的「後台」章節。
 */

const INBOX_SHEET = '委託';
const SCHEDULE_SHEET = '檔期';
const INBOX_HEADERS = ['收到時間', '處理狀態', '稱呼', 'Email', '其他聯絡', '專案名稱', '服務', '試算金額', '預估工作天', '最早開工', '交件日', '時程判斷', '稿件連結', '備註', '完整內容'];
const SCHEDULE_HEADERS = ['代稱', '服務', '工作內容', '開工日', '截稿日', '洽談中', '隱藏'];
const SERVICE_KEYS = { '排版': 'layout', '校對': 'proofread', '翻譯': 'translate' };

/** 第一次使用時執行一次：建立兩個分頁與標題列。 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inbox = ss.getSheetByName(INBOX_SHEET) || ss.insertSheet(INBOX_SHEET);
  if (inbox.getLastRow() === 0) {
    inbox.appendRow(INBOX_HEADERS);
    inbox.setFrozenRows(1);
    inbox.getRange('B2:B').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['待回覆', '已報價', '成立', '婉拒'], true).build()
    );
  }
  const sched = ss.getSheetByName(SCHEDULE_SHEET) || ss.insertSheet(SCHEDULE_SHEET);
  if (sched.getLastRow() === 0) {
    sched.appendRow(SCHEDULE_HEADERS);
    sched.setFrozenRows(1);
    sched.getRange('B2:B').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(SERVICE_KEYS), true).build()
    );
    sched.getRange('D2:E').setNumberFormat('yyyy-mm-dd');
    sched.getRange('F2:G').insertCheckboxes();
  }
}

/** 試算表上方多一個「接案」選單，方便把委託排進檔期。 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('接案')
    .addItem('把選取的委託排入檔期', 'scheduleSelected')
    .addToUi();
}

/** 在「委託」分頁選一列，執行後會在「檔期」新增一列並把狀態改成「成立」。 */
function scheduleSelected() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (sheet.getName() !== INBOX_SHEET || sheet.getActiveRange().getRow() < 2) {
    ui.alert('請先到「委託」分頁點選一筆委託。');
    return;
  }
  const row = sheet.getActiveRange().getRow();
  const v = sheet.getRange(row, 1, 1, INBOX_HEADERS.length).getValues()[0];
  const rec = Object.fromEntries(INBOX_HEADERS.map((h, i) => [h, v[i]]));
  const sched = ss.getSheetByName(SCHEDULE_SHEET);
  const count = Math.max(0, sched.getLastRow() - 1);
  const alias = '案主' + String.fromCharCode(65 + (count % 26));
  const firstService = String(rec['服務']).split('、')[0] || '校對';
  sched.appendRow([alias, firstService, rec['專案名稱'] || '', rec['最早開工'] || '', rec['交件日'] || '', false, false]);
  sched.getRange(sched.getLastRow(), 6, 1, 2).insertCheckboxes();
  sheet.getRange(row, 2).setValue('成立');
  ui.alert(`已排入檔期，代稱「${alias}」。\n請到「檔期」分頁確認開工日、截稿日與工作內容（這欄會公開在網站上）。`);
}

/** 網站讀取行事曆：只回傳「檔期」分頁的公開欄位。 */
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDULE_SHEET);
  const tz = Session.getScriptTimeZone();
  const fmt = (d) => (d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : String(d || '').trim());
  const rows = sheet ? sheet.getDataRange().getValues().slice(1) : [];
  const projects = rows
    .filter((r) => r[0] && r[3] && r[4] && r[6] !== true)
    .map((r) => ({
      client: String(r[0]),
      service: SERVICE_KEYS[String(r[1]).trim()] || 'proofread',
      title: String(r[2] || ''),
      start: fmt(r[3]),
      end: fmt(r[4]),
      tentative: r[5] === true
    }));
  return json({ ok: true, projects });
}

/** 網站送出委託：寫入「委託」分頁並寄信通知。 */
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad request' });
  }
  // 截斷長度，並避免案主輸入的「=」開頭文字被試算表當成公式執行
  const clip = (s, n) => String(s == null ? '' : s).slice(0, n).replace(/^[=+\-@]/, "'$&");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INBOX_SHEET);
  sheet.appendRow([
    new Date(), '待回覆',
    clip(data.name, 100), clip(data.email, 200), clip(data.contact, 200), clip(data.project, 200),
    clip(data.services, 100), Number(data.total) || '', Number(data.days) || '',
    clip(data.start, 20), clip(data.deadline, 20), clip(data.verdict, 100),
    clip(data.link, 500), clip(data.note, 2000), clip(data.message, 5000)
  ]);
  const owner = Session.getEffectiveUser().getEmail();
  if (owner) {
    MailApp.sendEmail({
      to: owner,
      replyTo: clip(data.email, 200),
      subject: `新委託：${clip(data.project || data.name, 60)}（NT$${Number(data.total || 0).toLocaleString()}）`,
      body: clip(data.message, 5000)
    });
  }
  return json({ ok: true });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
