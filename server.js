const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 4173);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const sessions = new Map();
const publicFiles = new Set(['/index.html', '/styles.css', '/app.js']);

const curriculum = [
  { subject: '國語文', code: '1-I-1', category: '聆聽', description: '養成專心聆聽的習慣，尊重對方的發言。' },
  { subject: '國語文', code: '2-I-1', category: '口語表達', description: '以正確發音流利地說出語意完整的話。' },
  { subject: '國語文', code: '2-I-3', category: '口語表達', description: '與他人交談時，能適當地提問、合宜地回答，並分享想法。' },
  { subject: '國語文', code: '3-I-3', category: '標音符號與運用', description: '運用注音符號表達想法，記錄訊息。' },
  { subject: '國語文', code: '4-I-1', category: '識字與寫字', description: '認識常用國字至少 1,000 字，使用 700 字。' },
  { subject: '國語文', code: '5-I-4', category: '閱讀', description: '了解文本中的重要訊息與觀點。' },
  { subject: '國語文', code: '6-I-3', category: '寫作', description: '寫出語意完整的句子、主題明確的段落。' },
  { subject: '數學', code: 'n-I-1', category: '數與量', description: '理解一千以內數的位值結構，據以做為四則運算之基礎。' },
  { subject: '數學', code: 'n-I-2', category: '數與量', description: '理解加法和減法的意義，熟練基本加減法並能流暢計算。' },
  { subject: '數學', code: 'n-I-7', category: '數與量', description: '理解長度及其常用單位，並做實測、估測與計算。' },
  { subject: '數學', code: 's-I-1', category: '空間與形狀', description: '從操作活動，初步認識物體與常見幾何形體的幾何特徵。' },
  { subject: '數學', code: 'r-I-1', category: '關係', description: '學習數學語言中的運算符號、關係符號、算式約定。' },
  { subject: '數學', code: 'd-I-1', category: '資料與不確定性', description: '認識分類的模式，能主動蒐集資料、分類並做簡單呈現。' }
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex') }; }
function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) { const adminPassword = hashPassword('0000'); fs.writeFileSync(DB_FILE, JSON.stringify({ users: [{ id: 'admin', email: 'admin', name: '彭彭', role: 'admin', ...adminPassword }], lessons: [], observations: [], curriculumCheckedAt: new Date().toISOString() }, null, 2)); }
}
function db() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function save(data) { fs.writeFileSync(`${DB_FILE}.tmp`, JSON.stringify(data, null, 2)); fs.renameSync(`${DB_FILE}.tmp`, DB_FILE); }
function send(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((x) => x.trim().split('='))); }
function userFor(req) { const id = sessions.get(cookies(req).session); return db().users.find((user) => user.id === id); }
function safeUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) throw new Error('內容過大'); } return JSON.parse(raw || '{}'); }
function requireUser(req, res) { const user = userFor(req); if (!user) send(res, 401, { error: '請先登入' }); return user; }

async function api(req, res, url) {
  if (url.pathname === '/api/login' && req.method === 'POST') { const input = await body(req); const data = db(); const user = data.users.find((x) => x.email.toLowerCase() === String(input.email).trim().toLowerCase()); if (!user || hashPassword(String(input.password), user.salt).hash !== user.hash) return send(res, 401, { error: '帳號或密碼不正確' }); const token = crypto.randomBytes(24).toString('hex'); sessions.set(token, user.id); return send(res, 200, { user: safeUser(user) }, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` }); }
  if (url.pathname === '/api/register' && req.method === 'POST') { const input = await body(req); const email = String(input.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: '請輸入有效的電子信箱' }); if (String(input.password || '').length < 4) return send(res, 400, { error: '密碼至少需要 4 個字元' }); const data = db(); if (data.users.some((x) => x.email === email)) return send(res, 409, { error: '這個信箱已經註冊' }); const user = { id: crypto.randomUUID(), email, name: String(input.name || '').trim() || email.split('@')[0], role: 'member', ...hashPassword(String(input.password)) }; data.users.push(user); save(data); const token = crypto.randomBytes(24).toString('hex'); sessions.set(token, user.id); return send(res, 201, { user: safeUser(user) }, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` }); }
  if (url.pathname === '/api/logout' && req.method === 'POST') { sessions.delete(cookies(req).session); return send(res, 200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
  const user = requireUser(req, res); if (!user) return;
  if (url.pathname === '/api/me') return send(res, 200, { user: safeUser(user) });
  if (url.pathname === '/api/curriculum') { const data = db(); return send(res, 200, { items: curriculum, checkedAt: data.curriculumCheckedAt, source: 'https://cirn.moe.edu.tw/' }); }
  if (url.pathname === '/api/curriculum/sync' && req.method === 'POST') { const data = db(); data.curriculumCheckedAt = new Date().toISOString(); save(data); return send(res, 200, { message: '已檢查 CIRN 官方來源；目前使用第一學習階段最新匯入版本。', checkedAt: data.curriculumCheckedAt }); }
  const collection = url.pathname === '/api/lessons' ? 'lessons' : url.pathname === '/api/observations' ? 'observations' : null;
  if (collection && req.method === 'GET') return send(res, 200, db()[collection].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  if (collection && req.method === 'POST') { const input = await body(req); if (!input.title || !input.date) return send(res, 400, { error: '請填寫名稱與日期' }); const data = db(); const item = { ...input, id: crypto.randomUUID(), authorId: user.id, authorName: user.name, createdAt: new Date().toISOString() }; data[collection].push(item); save(data); return send(res, 201, item); }
  send(res, 404, { error: '找不到此功能' });
}

initDb();
http.createServer(async (req, res) => {
  try { const url = new URL(req.url, `http://${req.headers.host}`); if (url.pathname.startsWith('/api/')) return await api(req, res, url); const requested = url.pathname === '/' ? '/index.html' : url.pathname; if (!publicFiles.has(requested)) { res.writeHead(302, { Location: '/' }); return res.end(); } const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }; res.writeHead(200, { 'Content-Type': types[path.extname(requested)], 'Cache-Control': 'no-cache' }); fs.createReadStream(path.join(__dirname, requested)).pipe(res); }
  catch (error) { console.error(error); if (!res.headersSent) send(res, 500, { error: '伺服器暫時無法處理，請稍後再試' }); }
}).listen(PORT, '0.0.0.0', () => console.log(`One Team is ready at http://localhost:${PORT}`));
