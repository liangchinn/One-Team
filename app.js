const sidebar = document.querySelector('#sidebar');
const dashboard = document.querySelector('#dashboard');
const placeholder = document.querySelector('#placeholder');
const dialog = document.querySelector('#createDialog');
const toast = document.querySelector('#toast');

const pages = {
  lessons: ['教案資料庫', '集中管理所有 VEX GO 課程版本、教材與授課備註。'],
  meetings: ['共備會議', '把討論、決策與待辦完整留在團隊的教學脈絡中。'],
  observations: ['觀議課紀錄', '透過課堂影像、觀察與回饋，讓經驗成為可複製的知識。'],
  training: ['師培學院', '循序學習教材、帶課與教學引導，完成你的講師旅程。'],
  team: ['團隊成長', '看見每位夥伴的學習進度、教學實踐與培訓成果。']
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

document.querySelector('#menuButton').addEventListener('click', () => sidebar.classList.toggle('open'));
document.querySelector('#createButton').addEventListener('click', () => dialog.showModal());
document.querySelector('#notificationButton').addEventListener('click', () => showToast('你目前沒有新的通知'));
document.querySelector('#profileButton').addEventListener('click', () => showToast('已登入：林宥安｜教學總監'));

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    if (page === 'dashboard') {
      dashboard.hidden = false;
      placeholder.hidden = true;
    } else {
      const [title, description] = pages[page];
      dashboard.hidden = true;
      placeholder.hidden = false;
      placeholder.innerHTML = `<p class="eyebrow">ONE TEAM WORKSPACE</p><h1>${title}</h1><p>${description}</p><div class="placeholder-card"><h2>這個空間已準備好了</h2><p>從右上角的「新增內容」開始建立第一筆資料，或返回總覽查看團隊的最新進度。</p></div>`;
    }
    sidebar.classList.remove('open');
  });
});

document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
  showToast(button.dataset.action === 'continue' ? '已開啟下一個培訓單元' : '已開啟〈超級機器車〉教案');
}));

document.querySelectorAll('.create-options button').forEach((button) => button.addEventListener('click', () => {
  const labels = { lesson: '教案', meeting: '會議紀錄', observation: '觀議課' };
  window.setTimeout(() => showToast(`已建立新的${labels[button.value]}`), 100);
}));

document.querySelector('#globalSearch').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.currentTarget.value.trim()) showToast(`正在搜尋「${event.currentTarget.value.trim()}」`);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#globalSearch').focus();
  }
});
