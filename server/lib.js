// 後端共用工具：回應格式、登入 session、欄位檢查
export const SERVICES = ['layout', 'proofread', 'translate'];
export const REQUEST_STATUSES = ['new', 'quoted', 'accepted', 'declined'];
const SESSION_DAYS = 30;
const enc = new TextEncoder();

// 資料表結構。第一次有人連上 API 時自動建立，不需要手動執行 SQL。
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  status     TEXT    NOT NULL DEFAULT 'new',   -- new 待回覆 / quoted 已報價 / accepted 成立 / declined 婉拒
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  contact    TEXT,
  project    TEXT,
  services   TEXT,
  total      INTEGER,
  days       INTEGER,
  start      TEXT,
  deadline   TEXT,
  verdict    TEXT,
  link       TEXT,
  note       TEXT,
  message    TEXT,
  admin_note TEXT
)`,
  `CREATE TABLE IF NOT EXISTS projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  alias        TEXT    NOT NULL,              -- 公開：網站上顯示的代稱
  service      TEXT    NOT NULL,              -- 公開：layout / proofread / translate
  title        TEXT,                          -- 公開：工作內容
  start_date   TEXT    NOT NULL,              -- 公開：開工日
  end_date     TEXT    NOT NULL,              -- 公開：截稿日
  tentative    INTEGER NOT NULL DEFAULT 0,    -- 公開：洽談中
  hidden       INTEGER NOT NULL DEFAULT 0,    -- 1 = 不在網站上顯示
  client_name  TEXT,                          -- 私人：真實案主名稱
  private_note TEXT,                          -- 私人：備註
  request_id   INTEGER REFERENCES requests(id) ON DELETE SET NULL
)`
];
let schemaReady = null;
export function ensureSchema(env) {
  schemaReady = schemaReady || env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}
export const fail = (message, status = 400) => json({ ok: false, error: message }, status);

export async function readJSON(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return null;
  try { return await request.json(); } catch { return null; }
}

// 字串欄位：去頭尾空白、截斷長度
export const str = (v, max) => String(v ?? '').trim().slice(0, max);
export const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
export const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v || '');

// ---------- session：cookie 內容是「到期時間.簽章」，用 ADMIN_PASSWORD 當簽章金鑰 ----------
// 改密碼後，所有已登入的裝置都會自動登出。
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function safeEqual(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
export async function makeSessionCookie(env) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const token = `${exp}.${await hmac(env.ADMIN_PASSWORD, 'session:' + exp)}`;
  return `session=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}
export const clearSessionCookie = 'session=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
export async function isLoggedIn(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, 'session:' + exp));
}

// ---------- 檔期欄位檢查（新增與修改共用）----------
export function projectFields(body) {
  const p = {
    alias: str(body.alias, 40),
    service: str(body.service, 20),
    title: str(body.title, 120),
    start: str(body.start, 10),
    end: str(body.end, 10),
    tentative: body.tentative ? 1 : 0,
    hidden: body.hidden ? 1 : 0,
    client_name: str(body.client_name, 100),
    private_note: str(body.private_note, 2000),
    request_id: Number.isInteger(body.request_id) ? body.request_id : null
  };
  if (!p.alias) return { error: '請填代稱（會公開顯示）' };
  if (!SERVICES.includes(p.service)) return { error: '服務類型不正確' };
  if (!isDate(p.start) || !isDate(p.end)) return { error: '開工日與截稿日請用 YYYY-MM-DD 格式' };
  if (p.end < p.start) return { error: '截稿日不能早於開工日' };
  return { value: p };
}
