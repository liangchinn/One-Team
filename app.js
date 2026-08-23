const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const sidebar = $('#sidebar');
const dashboard = $('#dashboard');
const placeholder = $('#placeholder');
const createDialog = $('#createDialog');
const editorDialog = $('#editorDialog');
const toast = $('#toast');
let currentUser = null;
let authMode = 'login';
const recordsById = new Map();
const staticMode = location.hostname.endsWith('github.io') || location.protocol === 'file:';

function localApi(path, options = {}) {
  const method = options.method || 'GET';
  const input = options.body ? JSON.parse(options.body) : {};
  const storedUser = JSON.parse(sessionStorage.getItem('oneTeamUser') || 'null');
  const users = JSON.parse(localStorage.getItem('oneTeamUsers') || '[]');
  if (path === '/login' && method === 'POST') {
    const isAdmin = input.email === 'admin' && input.password === '0000';
    const member = users.find((user) => user.email === String(input.email).toLowerCase() && user.password === input.password);
    if (!isAdmin && !member) throw new Error('帳號或密碼不正確');
    const user = isAdmin ? { id: 'admin', name: '彭彭', email: 'admin', role: 'admin' } : { ...member, password: undefined };
    sessionStorage.setItem('oneTeamUser', JSON.stringify(user)); return { user };
  }
  if (path === '/register' && method === 'POST') {
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('請輸入有效的電子信箱');
    if (users.some((user) => user.email === email)) throw new Error('這個信箱已經註冊');
    const user = { id: crypto.randomUUID(), name: input.name || email.split('@')[0], email, password: input.password, role: 'member' };
    users.push(user); localStorage.setItem('oneTeamUsers', JSON.stringify(users));
    const safe = { ...user, password: undefined }; sessionStorage.setItem('oneTeamUser', JSON.stringify(safe)); return { user: safe };
  }
  if (path === '/logout') { sessionStorage.removeItem('oneTeamUser'); return { ok: true }; }
  if (!storedUser) throw new Error('請先登入');
  if (path === '/me') return { user: storedUser };
  if (path === '/curriculum') return { items: window.CURRICULUM_ITEMS || [], checkedAt: new Date().toISOString() };
  if (path === '/curriculum/sync') return { message: '已連結 CIRN 官方來源。' };
  const key = path === '/lessons' ? 'oneTeamLessons' : path === '/observations' ? 'oneTeamObservations' : '';
  if (key && method === 'GET') return JSON.parse(localStorage.getItem(key) || '[]');
  if (key && method === 'POST') { const items = JSON.parse(localStorage.getItem(key) || '[]'); const item = { ...input, id: crypto.randomUUID(), authorName: storedUser.name, createdAt: new Date().toISOString() }; items.unshift(item); localStorage.setItem(key, JSON.stringify(items)); return item; }
  throw new Error('找不到此功能');
}

const api = async (path, options = {}) => {
  if (staticMode) return localApi(path, options);
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '操作失敗，請稍後再試');
  return data;
};

function showToast(message) { toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2400); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function setUser(user) {
  currentUser = user;
  $('#authScreen').classList.add('authenticated');
  $('#userName').textContent = user.name;
  $('#userRole').textContent = user.role === 'admin' ? '網站管理員' : '教學夥伴';
  $('#userInitial').textContent = user.name.slice(0, 1);
  $('#welcomeName').textContent = user.name;
  document.body.classList.remove('auth-locked');
}

$$('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => {
  authMode = tab.dataset.authTab;
  $$('[data-auth-tab]').forEach((item) => item.classList.toggle('active', item === tab));
  $('.register-field').hidden = authMode !== 'register';
  $('#authTitle').textContent = authMode === 'register' ? '加入拾光教學團隊' : '登入團隊工作台';
  $('#authSubtitle').textContent = authMode === 'register' ? '使用工作信箱建立你的帳號' : '使用你的團隊帳號繼續';
  $('.auth-submit').textContent = authMode === 'register' ? '建立帳號　→' : '登入工作台　→';
  $('#authError').textContent = '';
}));

$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  try { setUser((await api(`/${authMode}`, { method: 'POST', body: JSON.stringify(payload) })).user); event.currentTarget.reset(); }
  catch (error) { $('#authError').textContent = error.message; }
});

$('#menuButton').addEventListener('click', () => sidebar.classList.toggle('open'));
$('#createButton').addEventListener('click', () => createDialog.showModal());
$('#notificationButton').addEventListener('click', () => showToast('你目前沒有新的通知'));
$('#profileButton').addEventListener('click', async () => { if (confirm(`${currentUser.name}，要登出工作台嗎？`)) { await api('/logout', { method: 'POST' }); location.reload(); } });

const pageInfo = {
  meetings: ['共備會議', '把討論、決策與待辦完整留在團隊的教學脈絡中。'],
  training: ['師培學院', '循序學習教材、帶課與教學引導，完成你的講師旅程。'],
  team: ['團隊成長', '看見每位夥伴的學習進度、教學實踐與培訓成果。']
};

function recordCards(items, type) {
  if (!items.length) return '<div class="empty-state"><span>✦</span><h3>第一份紀錄，從這週開始</h3><p>建立內容後，團隊隨時都能回來調閱與延伸。</p></div>';
  return `<div class="record-grid">${items.map((item) => `<article class="record-card"><div class="record-top"><span class="pill ${type === 'lesson' ? 'blue' : 'lavender-pill'}">${type === 'lesson' ? escapeHtml(item.subject || 'VEX GO') : '觀議課'}</span><small>${escapeHtml(item.date || item.createdAt?.slice(0, 10))}</small></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(type === 'lesson' ? item.objectives : item.summary)}</p><footer><span>${escapeHtml(item.authorName)}</span><button class="text-button" data-view-id="${item.id}" data-view-type="${type}">查看完整紀錄 →</button></footer></article>`).join('')}</div>`;
}

async function renderRecords(type) {
  const isLesson = type === 'lesson';
  const items = await api(isLesson ? '/lessons' : '/observations');
  items.forEach((item) => recordsById.set(item.id, item));
  placeholder.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${isLesson ? 'WEEKLY LESSON DESIGN' : 'TEACHING REFLECTION'}</p><h1>${isLesson ? '每週教案' : '觀議課紀錄'}</h1><p>${isLesson ? '依照固定格式共備、設計與累積正式教案。' : '試教或觀課完成後，留下觀察、反思與下一步。'}</p></div><button class="primary-button" data-new="${type}">＋ 新增${isLesson ? '教案' : '紀錄'}</button></div>${recordCards(items, type)}`;
  bindPageActions();
}

async function renderCurriculum() {
  const data = await api('/curriculum');
  const groups = ['國語文', '數學'].map((subject) => `<section class="indicator-section"><div class="indicator-head"><div><span class="subject-dot ${subject === '國語文' ? 'language' : 'math'}"></span><h2>低年級${subject}</h2></div><span>${data.items.filter((x) => x.subject === subject).length} 項學習重點</span></div><div class="indicator-list">${data.items.filter((x) => x.subject === subject).map((x) => `<article><code>${escapeHtml(x.code)}</code><div><strong>${escapeHtml(x.category)}</strong><p>${escapeHtml(x.description)}</p></div><button class="copy-indicator" data-code="${escapeHtml(x.code)}">複製</button></article>`).join('')}</div></section>`).join('');
  placeholder.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MOE CURRICULUM GUIDELINES</p><h1>低年級基本學力指標</h1><p>第一學習階段（國小一、二年級）國語文與數學學習重點。</p></div><button class="outline-button" id="syncCurriculum">↻ 檢查最新版</button></div><div class="source-banner"><span>◎</span><div><strong>官方資料來源</strong><p>教育部十二年國民基本教育課程綱要／國家教育研究院課程及教學資源整合平臺（CIRN）</p><small>最近檢查：${new Date(data.checkedAt).toLocaleString('zh-TW')}</small></div><a href="https://cirn.moe.edu.tw/" target="_blank" rel="noopener">前往 CIRN ↗</a></div>${groups}`;
  $('#syncCurriculum').addEventListener('click', async () => { const result = await api('/curriculum/sync', { method: 'POST' }); showToast(result.message); });
  $$('.copy-indicator').forEach((button) => button.addEventListener('click', () => { navigator.clipboard?.writeText(button.dataset.code); showToast(`已複製 ${button.dataset.code}`); }));
}

async function navigate(page) {
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  dashboard.hidden = page !== 'dashboard'; placeholder.hidden = page === 'dashboard';
  if (page === 'lessons') await renderRecords('lesson');
  else if (page === 'observations') await renderRecords('observation');
  else if (page === 'curriculum') await renderCurriculum();
  else if (page !== 'dashboard') { const [title, desc] = pageInfo[page]; placeholder.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ONE TEAM WORKSPACE</p><h1>${title}</h1><p>${desc}</p></div></div><div class="empty-state"><span>✦</span><h3>這個空間已準備好了</h3><p>團隊下一階段的內容會從這裡開始累積。</p></div>`; }
  sidebar.classList.remove('open'); location.hash = page;
}

$$('.nav-item').forEach((item) => item.addEventListener('click', (event) => { event.preventDefault(); navigate(item.dataset.page); }));

const lessonFields = `<div class="form-grid"><label>教案名稱<input name="title" required placeholder="例：機械手臂大挑戰" /></label><label>日期<input name="date" type="date" required /></label><label>科目／領域<select name="subject"><option>VEX GO</option><option>國語文</option><option>數學</option><option>跨領域</option></select></label><label>年級／班級<input name="grade" placeholder="例：低年級 A 班" /></label><label class="full">學習表現與指標<input name="indicators" placeholder="例：n-I-2、2-I-1（可從學力指標頁複製）" /></label><label class="full">學習目標<textarea name="objectives" required placeholder="學生在課程結束後，能夠……"></textarea></label><label class="full">教材與準備<textarea name="materials" placeholder="器材、講義、場地配置與課前準備"></textarea></label></div><h3 class="form-section-title">教學活動設計</h3><div class="activity-editor"><div class="activity-row header"><span>階段</span><span>教師引導與教學內容</span><span>學生行為／任務</span><span>時間</span></div>${['準備活動','發展活動','綜合活動'].map((name) => `<div class="activity-row"><strong>${name}</strong><textarea name="teacher_${name}" placeholder="教師如何引導……"></textarea><textarea name="student_${name}" placeholder="學生如何參與……"></textarea><input name="time_${name}" placeholder="10 min" /></div>`).join('')}</div><label>評量方式<textarea name="assessment" placeholder="口頭評量、實作任務、課堂觀察……"></textarea></label>`;
const observationFields = `<div class="form-grid"><label>紀錄名稱<input name="title" required placeholder="例：機械手臂單元｜第一次試教" /></label><label>觀課日期<input name="date" type="date" required /></label><label>授課教師<input name="teacher" required /></label><label>觀課者<input name="observer" /></label><label class="full">觀課重點<input name="focus" placeholder="這次想特別觀察的學生行為或教學問題" /></label><label class="full">課堂事實紀錄<textarea name="evidence" required placeholder="依時間或教學階段，客觀記錄教師與學生的行為……"></textarea></label><label class="full">課後反思與發現<textarea name="reflection" placeholder="哪些作法有效？學生在哪裡卡住？"></textarea></label><label class="full">下一步行動（SMART）<textarea name="nextStep" placeholder="具體、可衡量、可達成、相關且有期限的改進行動"></textarea></label><label class="full">影像連結<input name="videoUrl" type="url" placeholder="Google Drive、YouTube 或雲端影像連結" /></label><label class="full">給授課者的一句話<textarea name="summary" placeholder="整體回饋與鼓勵"></textarea></label></div>`;

function openEditor(type) {
  const isLesson = type === 'lesson';
  $('#editorContent').innerHTML = `<p class="eyebrow">${isLesson ? 'LESSON DESIGN' : 'OBSERVATION RECORD'}</p><h2>${isLesson ? '建立每週教案' : '新增觀議課紀錄'}</h2><p class="editor-intro">${isLesson ? '將課程設計轉化為團隊可以持續共備、試教與優化的版本。' : '先記錄看見的事實，再整理反思與下一步行動。'}</p>${isLesson ? lessonFields : observationFields}<div class="form-actions"><button value="cancel" class="outline-button">取消</button><button type="submit" class="primary-button">儲存並分享</button></div>`;
  $('#editorForm').dataset.type = type; editorDialog.showModal();
}

function viewRecord(id, type) {
  const item = recordsById.get(id); if (!item) return;
  const lesson = type === 'lesson';
  const details = lesson
    ? `<div class="detail-meta"><span>${escapeHtml(item.date)}</span><span>${escapeHtml(item.subject || '')}</span><span>${escapeHtml(item.grade || '')}</span><span>設計者：${escapeHtml(item.authorName)}</span></div><section class="detail-section"><h3>學習指標</h3><p>${escapeHtml(item.indicators || '—')}</p><h3>學習目標</h3><p>${escapeHtml(item.objectives || '—')}</p><h3>教材與準備</h3><p>${escapeHtml(item.materials || '—')}</p></section><div class="detail-activities">${(item.activities || []).map((activity) => `<article><header><strong>${escapeHtml(activity.stage)}</strong><span>${escapeHtml(activity.time || '')}</span></header><div><small>教師引導與教學內容</small><p>${escapeHtml(activity.teacher || '—')}</p><small>學生行為／任務</small><p>${escapeHtml(activity.student || '—')}</p></div></article>`).join('')}</div><section class="detail-section"><h3>評量方式</h3><p>${escapeHtml(item.assessment || '—')}</p></section>`
    : `<div class="detail-meta"><span>${escapeHtml(item.date)}</span><span>授課：${escapeHtml(item.teacher)}</span><span>觀課：${escapeHtml(item.observer || item.authorName)}</span></div><section class="detail-section"><h3>觀課重點</h3><p>${escapeHtml(item.focus || '—')}</p><h3>課堂事實紀錄</h3><p>${escapeHtml(item.evidence || '—')}</p><h3>課後反思與發現</h3><p>${escapeHtml(item.reflection || '—')}</p><h3>下一步行動（SMART）</h3><p>${escapeHtml(item.nextStep || '—')}</p><h3>整體回饋</h3><p>${escapeHtml(item.summary || '—')}</p>${item.videoUrl ? `<a class="video-link" href="${escapeHtml(item.videoUrl)}" target="_blank" rel="noopener">▶ 開啟觀課影像</a>` : ''}</section>`;
  $('#editorContent').innerHTML = `<p class="eyebrow">${lesson ? 'LESSON RECORD' : 'OBSERVATION RECORD'}</p><h2>${escapeHtml(item.title)}</h2>${details}<div class="form-actions"><button value="cancel" class="primary-button">關閉</button></div>`;
  $('#editorForm').dataset.type = 'view'; editorDialog.showModal();
}

function bindPageActions() {
  $('[data-new]')?.addEventListener('click', (event) => openEditor(event.currentTarget.dataset.new));
  $$('[data-view-id]').forEach((button) => button.addEventListener('click', () => viewRecord(button.dataset.viewId, button.dataset.viewType)));
}
$('#editorForm').addEventListener('submit', async (event) => {
  const type = event.currentTarget.dataset.type; if (type === 'view') return;
  event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget));
  if (type === 'lesson') fields.activities = ['準備活動','發展活動','綜合活動'].map((stage) => ({ stage, teacher: fields[`teacher_${stage}`], student: fields[`student_${stage}`], time: fields[`time_${stage}`] }));
  try { await api(type === 'lesson' ? '/lessons' : '/observations', { method: 'POST', body: JSON.stringify(fields) }); editorDialog.close(); showToast('已儲存，團隊現在可以查看'); await renderRecords(type); }
  catch (error) { showToast(error.message); }
});

$$('.create-options button').forEach((button) => button.addEventListener('click', () => { const type = button.value === 'observation' ? 'observation' : 'lesson'; setTimeout(() => openEditor(type), 80); }));
$('#globalSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) showToast(`正在搜尋「${event.currentTarget.value.trim()}」`); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); } });

api('/me').then(({ user }) => setUser(user)).catch(() => {
  document.body.classList.add('auth-locked');
  $('#authScreen').classList.remove('authenticated');
  window.setTimeout(() => $('[name="email"]')?.focus(), 150);
});
