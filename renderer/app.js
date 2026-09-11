'use strict';

/* global studio */

const $ = (sel, el = document) => el.querySelector(sel);

const MODE_LABEL = { text: '文生视频', image: '图生视频', reference: '参考生视频', edit: '视频编辑' };
const STATUS_LABEL = {
  draft: '草稿', submitting: '提交中', queued: '排队中', running: '生成中',
  succeeded: '已完成', failed: '失败', cancelled: '已取消', expired: '已过期',
};
const DEFAULT_MODEL = 'minimax-h3';
const QUICK_DURATIONS = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

/* ---------------- 主题（夜间 / 日间 / 跟随系统） ---------------- */

const THEME_KEY = 'td-theme';
const THEME_ORDER = ['dark', 'light', 'system'];
const THEME_LABEL = { dark: '夜间模式', light: '日间模式', system: '跟随系统' };
const THEME_ICONS = {
  dark: '<svg viewBox="0 0 24 24"><path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  light: '<svg viewBox="0 0 24 24"><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  system: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 20.5h6M12 17v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

function currentThemePref() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}

function applyTheme() {
  const pref = currentThemePref();
  const resolved = pref === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : pref;
  document.documentElement.dataset.theme = resolved;
  const btn = $('#btn-theme');
  if (btn) {
    btn.innerHTML = THEME_ICONS[pref];
    btn.title = `主题：${THEME_LABEL[pref]}（点击切换）`;
  }
}

function cycleTheme() {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(currentThemePref()) + 1) % THEME_ORDER.length];
  try { localStorage.setItem(THEME_KEY, next); } catch { /* 忽略 */ }
  applyTheme();
}

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (currentThemePref() === 'system') applyTheme();
});

const ICONS = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="12" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 6V4.8A1.2 1.2 0 0 1 11.2 3.6h1.6A1.2 1.2 0 0 1 14 4.8V6M6 7l1 12.2a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7M10.3 11v6M13.7 11v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 1.5.7l1.3 1.6a2 2 0 0 0 1.5.7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.6" cy="9.6" r="1.5" fill="currentColor"/><path d="M4 17.5 9.5 12.5l3.2 3 3.2-2.8 4.1 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 3.5 21.5 20h-19z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1" fill="currentColor"/></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M10 5H5v14h14v-5M13.5 5H19v5.5M18.6 5.4 11 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16 10.5 5-3v9l-5-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 18.5V6l11-2.5V16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6M14 10a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3.2 5 5.8v5.4c0 4.4 3 8.2 7 9.6 4-1.4 7-5.2 7-9.6V5.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9.2 11.6 1.9 1.9 3.7-3.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/* 厂商官方图标（路径来自 simple-icons，CC0 授权），按家族 key 着色 */
const FAMILY_ICONS = {
  minimax: 'M11.43 3.92a.86.86 0 1 0-1.718 0v14.236a1.999 1.999 0 0 1-3.997 0V9.022a.86.86 0 1 0-1.718 0v3.87a1.999 1.999 0 0 1-3.997 0V11.49a.57.57 0 0 1 1.139 0v1.404a.86.86 0 0 0 1.719 0V9.022a1.999 1.999 0 0 1 3.997 0v9.134a.86.86 0 0 0 1.719 0V3.92a1.998 1.998 0 1 1 3.996 0v11.788a.57.57 0 1 1-1.139 0zm10.572 3.105a2 2 0 0 0-1.999 1.997v7.63a.86.86 0 0 1-1.718 0V3.923a1.999 1.999 0 0 0-3.997 0v16.16a.86.86 0 0 1-1.719 0V18.08a.57.57 0 1 0-1.138 0v2a1.998 1.998 0 0 0 3.996 0V3.92a.86.86 0 0 1 1.719 0v12.73a1.999 1.999 0 0 0 3.996 0V9.023a.86.86 0 1 1 1.72 0v6.686a.57.57 0 0 0 1.138 0V9.022a2 2 0 0 0-1.998-1.997',
  wan: 'M3.996 4.517h5.291L8.01 6.324 4.153 7.506a1.668 1.668 0 0 0-1.165 1.601v5.786a1.668 1.668 0 0 0 1.165 1.6l3.857 1.183 1.277 1.807H3.996A3.996 3.996 0 0 1 0 15.487V8.513a3.996 3.996 0 0 1 3.996-3.996m16.008 0h-5.291l1.277 1.807 3.857 1.182c.715.227 1.17.889 1.165 1.601v5.786a1.668 1.668 0 0 1-1.165 1.6l-3.857 1.183-1.277 1.807h5.291A3.996 3.996 0 0 0 24 15.487V8.513a3.996 3.996 0 0 0-3.996-3.996m-4.007 8.345H8.002v-1.804h7.995Z',
  seedance: 'M19.8772 1.4685L24 2.5326v18.9426l-4.1228 1.0563V1.4685zm-13.3481 9.428l4.115 1.0641v8.9786l-4.115 1.0642v-11.107zM0 2.572l4.115 1.0642v16.7354L0 21.428V2.572zm17.4553 5.6205v11.107l-4.1228-1.0642V9.2568l4.1228-1.0642z',
  kling: 'M5.493 21.234c-1.112-1.451-1.109-4.263-.081-7.459l-4.557-2.63a1.683 1.683 0 01-.85-1.304 1.505 1.505 0 01.08-.622 13.18 13.18 0 011.037-2.255c3.476-6.02 10.916-8.23 16.619-4.938.46.266.82.67 1.081 1.184.785 1.545.685 4.096-.234 6.954l4.557 2.631c.339.196.596.492.736.832a1.53 1.53 0 01.034 1.093 13.146 13.146 0 01-1.037 2.255c-3.476 6.02-10.916 8.23-16.619 4.938a2.6 2.6 0 01-.766-.68zm11.096-6.615c-2.073 3.591-5.808 5.316-8.343 3.852-1.267-.731-1.994-2.122-2.145-3.778-.095-1.035.036-2.173.4-3.32.217-.684.517-1.37.902-2.039l.008-.014c2.073-3.59 5.808-5.315 8.343-3.852.633.366 1.13.895 1.49 1.54.986 1.772.922 4.415-.285 6.914-.111.23-.232.457-.362.683l-.008.014z',
  happyhorse: 'M12 3.4A7.6 7.6 0 0 0 4.4 11v7.3c0 .8.7 1.5 1.5 1.5h2.5c.8 0 1.5-.7 1.5-1.5V11a2.1 2.1 0 1 1 4.2 0v7.3c0 .8.7 1.5 1.5 1.5h2.5c.8 0 1.5-.7 1.5-1.5V11A7.6 7.6 0 0 0 12 3.4z',
};

function famIcon(key) {
  const d = FAMILY_ICONS[key];
  if (!d) return '';
  // 可灵官方环形 logo 依赖 evenodd 抠出环内镂空；其余图标不需要
  const rule = key === 'kling' ? ' fill-rule="evenodd" clip-rule="evenodd"' : '';
  return `<svg class="fam-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path${rule} d="${d}"/></svg>`;
}

const state = {
  tasks: [],
  models: [],
  modelSync: { source: 'builtin', syncedAt: 0 },
  modelSyncing: false,
  appInfo: null,           // { version, isElectron } — 启动时由 /api/app/info 填入
  updateCheckBusy: false,  // 防重入：检查更新中时按钮禁用
  // 创作台当前工单的 id（可为 null）。只表示「编辑器里正在配的那一单」，
  // 提交后即清空，与作品墙上被选中的卡片无关（那是 modalId）
  selectedId: null,
  settings: null,
  detailSig: '',
  saveStateTimer: null,
  filter: 'all',
  tab: 'studio',
  modalId: null,
  wallSig: null,
  modalSig: '',

  // 模型选择器的展开态与搜索词：纯视图状态，不进 tasks.json，也不该被任务切换重置
  modelPickerOpen: false,
  modelQuery: '',
};

// 快捷键提示里的修饰键符号
const MOD_HINT = /Mac/i.test(navigator.platform || '') ? '⌘' : 'Ctrl+';

let pendingPatch = {};
let saveDebounce = null;

/* ---------------- 工具 ---------------- */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 本地文件通过服务器的 /media 端点流式输出（支持 Range，视频可拖动进度）
function toMediaUrl(p) {
  return '/media?path=' + encodeURIComponent(String(p));
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtElapsed(sinceTs) {
  const sec = Math.max(0, Math.floor((Date.now() - sinceTs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtClock(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showToast(message, tone = '') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

function getTask(id) {
  return state.tasks.find((t) => t.id === id) || null;
}

/* 目录里精确查找：查不到就是查不到。
   判断「这个任务用了哪个模型」必须用它 —— getModel 会静默兜底到 DEFAULT_MODEL，
   用在那里会把「还没选模型」显示成一个具体的模型，用户看到的是假信息 */
function findModel(id) {
  return state.models.find((m) => m.id === id) || null;
}

function getModel(id) {
  return findModel(id) || findModel(DEFAULT_MODEL);
}

// 「在文件夹中显示」按钮文案按平台区分
const IS_MAC = /Mac/i.test(navigator.platform || '');
const IS_WIN = /Win/i.test(navigator.platform || '');
const REVEAL_LABEL = IS_MAC ? '在 Finder 中显示' : IS_WIN ? '在资源管理器中显示' : '在文件夹中显示';

function editable(t) {
  return t && (t.status === 'draft' || t.status === 'failed');
}

// 把主进程返回的最新任务合并进本地状态，避免等待广播造成的闪烁
function mergeTask(updated) {
  if (!updated || !updated.id) return;
  const i = state.tasks.findIndex((x) => x.id === updated.id);
  if (i >= 0) state.tasks[i] = updated;
  else state.tasks.unshift(updated);
  // 只刷新作品墙：mergeTask 在每次打字防抖落盘后都会被调用，
  // 一旦在这里重绘创作台，输入框会被重建 —— 失焦、光标跳首、中文输入法组合中断
  renderWall();
}

function ratioLabel(r) {
  return r === 'adaptive' ? '自适应' : r;
}

function durationLabel(d) {
  return Number(d) === -1 ? '智能' : `${d}s`;
}

/* ---------------- 模型目录同步 ---------------- */

// 不显示模型数量：目录每次启动都会跟网关同步，写死数字会随新模型上架而过时
function syncStatusText() {
  const s = state.modelSync;
  if (s.source === 'remote' && s.syncedAt) return `模型目录 · 已同步 ${fmtClock(s.syncedAt)}`;
  if (s.source === 'cache') return `模型目录 · 本地缓存`;
  return `模型目录 · 内置`;
}

// 只更新状态行与刷新按钮，避免为文案变化重渲染整个编辑器
function updateSyncUI() {
  const el = $('#sync-status');
  if (el) el.textContent = syncStatusText();
  const btn = $('[data-action="sync-models"]');
  if (btn) {
    btn.disabled = state.modelSyncing;
    btn.classList.toggle('spinning', state.modelSyncing);
  }
}

async function refreshModels(manual = false) {
  if (state.modelSyncing) return;
  state.modelSyncing = true;
  updateSyncUI();
  try {
    const res = await studio.syncModels();
    if (!res || !Array.isArray(res.models)) return;
    const changed = res.models.map((m) => m.id).join(',') !== state.models.map((m) => m.id).join(',');
    state.models = res.models;
    state.modelSync = { source: res.source || 'builtin', syncedAt: res.syncedAt || 0 };
    if (changed) {
      // 目录有变化：重渲染编辑器里的模型选择器；当前任务已保存的模型 id 仍在列表中即保留
      const t = getTask(state.selectedId);
      if (t && editable(t)) {
        await flushSave(t); // 先把未落盘的编辑保存掉，避免重渲染丢字
        renderDetail(true);
      }
    }
    if (manual) {
      if (res.error) {
        showToast(`模型目录同步失败，${res.source === 'cache' ? '已使用本地缓存' : '使用内置目录'}：${res.error}`, 'error');
      } else {
        showToast(`模型目录已同步（${res.models.length} 个模型）`, 'success');
      }
    }
  } catch (err) {
    if (manual) showToast(err.message, 'error');
  } finally {
    state.modelSyncing = false;
    updateSyncUI();
  }
}

/* ---------------- 自动保存管道 ---------------- */

function markSaved() {
  const el = $('#save-state');
  if (!el) return;
  el.textContent = '已自动保存';
  if (state.saveStateTimer) clearTimeout(state.saveStateTimer);
  state.saveStateTimer = setTimeout(() => {
    const cur = $('#save-state');
    if (cur) cur.textContent = '更改会自动保存';
  }, 2000);
}

async function flushSave(t) {
  if (saveDebounce) {
    clearTimeout(saveDebounce);
    saveDebounce = null;
  }
  if (!t || !Object.keys(pendingPatch).length) return;
  const patch = pendingPatch;
  pendingPatch = {};
  try {
    const updated = await studio.updateTask(t.id, patch);
    mergeTask(updated);
    markSaved();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function scheduleSave(t, patch) {
  Object.assign(pendingPatch, patch);
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => flushSave(t), 400);
}

/* ---------------- 作品墙 ---------------- */

const WALL_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'succeeded', label: '已完成' },
  { key: 'failed', label: '未成功' },
];
const ACTIVE_STATUSES = ['submitting', 'queued', 'running'];

// 草稿属于创作台，不属于作品：作品墙上只会出现已经提交过的任务
const isWork = (t) => t.status !== 'draft';

function wallInGroup(t, key) {
  switch (key) {
    case 'active': return ACTIVE_STATUSES.includes(t.status);
    case 'succeeded': return t.status === 'succeeded';
    case 'failed': return t.status === 'failed' || t.status === 'cancelled' || t.status === 'expired';
    default: return true;
  }
}

function wallTasks() {
  return state.tasks.filter(isWork);
}

/* 单卡签名：决定「这一张卡要不要重建」。
   刻意不含 updatedAt —— 每轮轮询都会改它，含进去等于没有签名 */
function cardSig(t) {
  return [t.id, t.status, t.mode, t.model, t.duration, t.resolution, t.ratio, t.audio,
    t.prompt, t.videoPath, t.downloadError, t.error, t.createdAt, t.submittedAt].join('\u0001');
}

function renderWallFilters(works) {
  const box = $('#wall-filters');
  if (!box) return;
  box.innerHTML = WALL_FILTERS.map((f) => {
    const n = works.filter((t) => wallInGroup(t, f.key)).length;
    return `<button type="button" class="qchip ${state.filter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}<span class="qchip-n">${n}</span></button>`;
  }).join('');
}

function badge(t) {
  const pulse = t.status === 'running' || t.status === 'submitting' ? ' pulse' : '';
  return `<span class="badge badge-${t.status}${pulse}">${STATUS_LABEL[t.status] || t.status}</span>`;
}

function metaLine(t) {
  const parts = [durationLabel(t.duration), t.resolution];
  if (t.ratio) parts.push(ratioLabel(t.ratio));
  if (t.audio) parts.push('有声');
  return parts.join(' · ');
}

/* 卡片参数用彩色小签呈现，替代一长串点分文字 */
function metaChipsHtml(t) {
  // 还没选模型的草稿没有任何参数可展示，给个占位，别渲染一排空 chip
  if (!t.model) return '<span class="meta-chip">待选择模型</span>';
  const parts = [MODE_LABEL[t.mode] || t.mode, durationLabel(t.duration), t.resolution];
  if (t.ratio) parts.push(ratioLabel(t.ratio));
  if (t.audio) parts.push('有声');
  return parts.map((p) => `<span class="meta-chip">${escapeHtml(p)}</span>`).join('');
}

/* 封面。已完成且有本地文件的直接上 <video> 抽首帧：
   preload="metadata" 只拉 moov 与首个 GOP，#t=0.1 让解码器直接定位到非零时刻，
   避开最常见的黑场/渐入开场。实测 Chromium 下 readyState 到 4、videoWidth 正常，
   CSP 的 media-src 'self' 允许同源 /media，不需要额外放行。 */
function coverHtml(t) {
  const model = findModel(t.model);
  if (t.status === 'succeeded' && t.videoPath) {
    return `<video src="${toMediaUrl(t.videoPath)}#t=0.1" preload="metadata" muted playsinline></video>`;
  }
  if (ACTIVE_STATUSES.includes(t.status)) {
    // 网关只回 status、不给百分比，所以这里只能是不定量流光 + 已用时长，做不出真实进度条
    return `<div class="cover-skeleton" aria-hidden="true"></div>
      <div class="running-bar"><i></i></div>
      <span class="cover-elapsed" data-since="${t.submittedAt || t.updatedAt}">${fmtElapsed(t.submittedAt || t.updatedAt)}</span>`;
  }
  if (t.status === 'succeeded') {
    return `<div class="cover-ph">${ICONS.refresh}<span>${t.downloadError ? '下载未完成' : '正在下载'}</span></div>`;
  }
  return `<div class="cover-ph">${ICONS.alert}<span>${escapeHtml(STATUS_LABEL[t.status] || t.status)}</span></div>`;
}

function workCardHtml(t) {
  const prompt = (t.prompt || '').trim();
  const model = findModel(t.model);
  const durTag = (t.status === 'succeeded' && t.videoPath)
    ? `<span class="cover-tag">${escapeHtml(durationLabel(t.duration))}</span>` : '';
  return `
    <article class="work-card" data-id="${escapeHtml(t.id)}" data-family="${model ? escapeHtml(model.family) : ''}">
      <button type="button" class="work-cover" data-action="open-work" aria-label="播放这个片段">
        ${coverHtml(t)}
        ${durTag}
      </button>
      <div class="work-body">
        <div class="work-top">
          <span class="work-model">${famIcon(model ? model.family : '')}${escapeHtml(model ? model.name : (t.model || '未选模型'))}</span>
          ${badge(t)}
        </div>
        <p class="work-prompt ${prompt ? '' : 'empty'}">${prompt ? escapeHtml(prompt) : '（未填写提示词）'}</p>
        <div class="work-meta">${metaChipsHtml(t)}</div>
      </div>
      <div class="work-foot">
        <span class="card-time">${fmtTime(t.createdAt)}</span>
        <span class="work-actions">
          <button class="icon-btn" data-action="duplicate" title="复制为新片段">${ICONS.copy}</button>
          <button class="icon-btn" data-action="remove" title="删除">${ICONS.trash}</button>
        </span>
      </div>
    </article>`;
}

function htmlToEl(html) {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box.firstElementChild;
}

/* 逐卡比对而不是整体重写：生成期间每轮轮询都会推一次任务列表，
   整体重写会连带把 <video> 节点销毁重建 —— 表现为封面闪烁 + 重新拉一遍 Range 请求。
   只有签名变了的卡才替换，其余节点原地不动。 */
function syncGrid(grid, visible) {
  const keep = new Set();
  visible.forEach((t, i) => {
    keep.add(t.id);
    const sig = cardSig(t);
    let card = grid.querySelector(`.work-card[data-id="${CSS.escape(t.id)}"]`);
    if (!card) {
      card = htmlToEl(workCardHtml(t));
      card.dataset.sig = sig;
    } else if (card.dataset.sig !== sig) {
      const next = htmlToEl(workCardHtml(t));
      next.dataset.sig = sig;
      card.replaceWith(next);
      card = next;
    }
    if (grid.children[i] !== card) grid.insertBefore(card, grid.children[i] || null);
  });
  [...grid.children].forEach((c) => { if (!keep.has(c.dataset.id)) c.remove(); });
}

/* 作品墙的骨架只建一次，之后只更新里面的内容 —— 整体重写会把 <video> 一起带走 */
let wallMounted = false;

function mountWall() {
  const wall = $('#panel-wall');
  if (!wall || wallMounted) return;
  wallMounted = true;
  wall.innerHTML = `
    <div class="wall-head">
      <div class="wall-head-inner">
        <div class="wall-title">作品墙<span class="wall-sub" id="wall-sub"></span></div>
        <div id="wall-filters" class="wall-filters"></div>
      </div>
    </div>
    <div class="wall-scroll" id="wall-scroll">
      <div class="detail-inner">
        <div id="work-grid" class="work-grid"></div>
        <div id="wall-empty" class="hidden"></div>
      </div>
    </div>`;
}

function renderWall(force = false) {
  if (!wallMounted) return;
  const works = wallTasks();
  const visible = works.filter((t) => wallInGroup(t, state.filter));
  const sig = state.filter + '\u0002' + visible.map(cardSig).join('\u0003');
  if (!force && sig === state.wallSig) return;
  state.wallSig = sig;

  const sub = $('#wall-sub');
  if (sub) sub.textContent = works.length ? `${works.length} 个片段` : '';

  renderWallFilters(works);

  const grid = $('#work-grid');
  const empty = $('#wall-empty');
  if (!grid || !empty) return;

  if (!visible.length) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    const label = (WALL_FILTERS.find((f) => f.key === state.filter) || {}).label || '';
    empty.innerHTML = works.length
      ? `<div class="wall-empty"><p>没有「${label}」的作品</p><button class="btn btn-ghost btn-sm" data-action="filter-all">看全部</button></div>`
      : `<div class="wall-empty">
           <h3>作品墙还空着</h3>
           <p>去创作台写下第一张工单，提交后作品会挂到这里，生成进度也在这里实时更新。</p>
           <button class="btn btn-primary" data-action="go-studio">${ICONS.plus}去创作台</button>
         </div>`;
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.classList.remove('hidden');
  syncGrid(grid, visible);
}

/* ---------------- 创作台 / tab 外壳 ---------------- */

// 创作台的「当前工单」：只有还能改的任务才配占着编辑器
function currentOrder() {
  const t = getTask(state.selectedId);
  return editable(t) ? t : null;
}

function renderTabs() {
  const n = wallTasks().length;
  const cnt = $('#tab-count');
  if (cnt) cnt.textContent = n ? String(n) : '';
  document.querySelectorAll('.tabbar .tab').forEach((b) => {
    const on = b.dataset.tab === state.tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const studio = $('#panel-studio');
  const wall = $('#panel-wall');
  if (studio) studio.classList.toggle('hidden', state.tab !== 'studio');
  if (wall) wall.classList.toggle('hidden', state.tab !== 'wall');
}

function switchTab(tab) {
  if (tab !== 'studio' && tab !== 'wall') return;
  closeWorkModal();
  state.tab = tab;
  renderTabs();
}

function renderStudio(force = false) {
  const box = $('#panel-studio');
  if (!box) return;
  const t = currentOrder();
  // 空态文案取决于「是否已经有作品」，所以任务数也要进签名
  const sig = t
    ? [t.id, t.status, t.mode, t.model, t.error, t.downloadError, t.videoPath, t.videoUrl, t.audio].join('|')
    : `empty:${state.tasks.length}`;
  if (!force && sig === state.detailSig) return;
  state.detailSig = sig;
  box.innerHTML = t ? editorHtml(t) : emptyHtml();
}

// 老代码里的 renderDetail(true) 现在等价于「重绘创作台 + 同步 tab 与作品墙」。
// 注意 renderWall 不带 force：作品墙靠自己的签名短路，强制重绘会重载封面视频
function renderDetail(force = false) {
  renderTabs();
  renderStudio(force);
  renderWall();
}

/* ---------------- 作品弹层 ----------------
   全项目只有这一处放 <video controls>，作品墙上的是静音抽帧封面 */

function modalBodyHtml(t) {
  if (t.status === 'succeeded') return playerHtml(t);
  if (ACTIVE_STATUSES.includes(t.status)) return progressHtml(t);
  return readonlyHtml(t);
}

function renderWorkModal(force = false) {
  const mask = $('#work-modal');
  if (!mask) return;
  const t = getTask(state.modalId);
  if (!t) {
    mask.classList.add('hidden');
    return;
  }
  // 弹层里也有 <video>，同样要签名短路，否则 SSE 每推一次就把播放打断一次
  const sig = [cardSig(t), t.videoUrl].join('\u0001');
  if (!force && sig === state.modalSig) return;
  state.modalSig = sig;
  $('#work-modal-title').textContent = t.status === 'succeeded'
    ? '生成结果'
    : (STATUS_LABEL[t.status] || '片段详情');
  $('#work-modal-body').innerHTML = modalBodyHtml(t);
  mask.classList.remove('hidden');
}

function openWorkModal(id) {
  if (!getTask(id)) return;
  state.modalId = id;
  renderWorkModal(true);
}

function closeWorkModal() {
  state.modalId = null;
  state.modalSig = '';
  const mask = $('#work-modal');
  if (mask) mask.classList.add('hidden');
}

function emptyHtml() {
  // 空态有两种语义：还没有第一单，和「这一单已下达、可以再开一单了」
  const started = state.tasks.length > 0;
  return `
    <div class="empty-state">
      <div class="empty-mark">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="40" height="40" rx="10" class="mk-stroke-border" stroke-width="1.5"/>
          <path d="M17 15.5v17l14.5-8.5z" class="mk-stroke-mute" stroke-width="1.6" stroke-linejoin="round"/>
          <circle cx="17" cy="15.5" r="2.4" class="mk-fill-accent"/>
          <circle cx="17" cy="32.5" r="1.7" class="mk-fill-mute"/>
          <circle cx="31.5" cy="24" r="1.7" class="mk-fill-mute"/>
          <path d="M36 18v12" class="mk-stroke-accent" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M39.5 20.4v7.2" class="mk-stroke-mute" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <h2>${started ? '这一单已下达' : '从第一段视频开始'}</h2>
      <p>${started
        ? '作品已经挂到作品墙，生成进度在那里实时更新。想再出一段，就再开一张工单。'
        : '创作台一次只配一段：选好模型、填上提示词与参数，提交后作品会挂到作品墙。'}</p>
      <button class="btn btn-primary" data-action="new">${ICONS.plus}${started ? '再开一单' : '新建工单'}</button>
      ${vendorRowHtml()}
      <div class="empty-hint">TOKENDANCE.SPACE · VIDEO MODELS</div>
      <div class="empty-trust">
        <span>${ICONS.shield}API Key 与素材仅保存在本机</span>
        <span>素材只在提交时发送给你自己的网关</span>
        <span>仅监听 127.0.0.1 · 开源可审计</span>
      </div>
    </div>`;
}

function vendorRowHtml() {
  const seen = new Map();
  for (const m of state.models) {
    if (!seen.has(m.family)) seen.set(m.family, m.familyName || m.family);
  }
  if (!seen.size) return '';
  const chips = [...seen.entries()].map(([key, name]) =>
    `<span class="vendor-chip" data-family="${escapeHtml(key)}">${famIcon(key)}${escapeHtml(name)}</span>`).join('');
  // 走马灯靠多份副本无缝循环，副本不够多的话轨道滑到末端会露出空档。
  // 这里渲染 3 份、位移 1/3：只要单份宽度 > 容器宽度的 1/2 就不会穿帮，
  // 当前单份约 620px、容器 540px，留有余量。副本对读屏隐藏。
  const group = (dup) => `<div class="vendor-group"${dup ? ' aria-hidden="true"' : ''}>${chips}</div>`;
  return `<div class="empty-vendors"><div class="vendor-track">${group(0)}${group(1)}${group(1)}</div></div>`;
}

function readonlyHtml(t) {
  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">${STATUS_LABEL[t.status] || t.status}</h2>
          <div class="detail-sub">${escapeHtml(t.model)} · ${MODE_LABEL[t.mode] || t.mode} · ${escapeHtml(metaLine(t))} · 创建于 ${fmtTime(t.createdAt)}</div>
        </div>
        <div class="detail-actions">
          ${t.status === 'failed'
            // 只有 failed 能回到编辑器：main/tasks.js 的 update() 只放行 draft / failed
            ? `<button class="btn btn-primary" data-action="credit">${ICONS.refresh}重新编辑</button>
               <button class="btn btn-ghost" data-action="duplicate">${ICONS.copy}复制为新片段</button>`
            : `<button class="btn btn-primary" data-action="duplicate">${ICONS.copy}复制为新片段</button>`}
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-key">提示词</span><span class="meta-val">${escapeHtml(t.prompt || '（无）')}</span></div>
        <div class="meta-row"><span class="meta-key">远程任务</span><span class="meta-val mono">${escapeHtml(t.remoteId || '—')}</span></div>
        ${t.error ? `<div class="meta-row"><span class="meta-key">错误信息</span><span class="meta-val" style="color:var(--bad)">${escapeHtml(t.error)}</span></div>` : ''}
      </div>
    </div>`;
}

function progressHtml(t) {
  const statusText = (t.status === 'submitting' ? 'SUBMITTING' : t.status === 'queued' ? 'QUEUED' : 'RUNNING');
  const sub = t.status === 'submitting'
    ? '正在向网关提交任务…'
    : t.status === 'queued'
      ? '任务已进入远端队列，等待模型调度'
      : '模型正在渲染画面，时长越长耗时越久';
  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">片段生成中</h2>
          <div class="detail-sub">${escapeHtml(t.model)} · ${MODE_LABEL[t.mode] || t.mode} · ${escapeHtml(metaLine(t))}</div>
        </div>
        ${badge(t)}
      </div>
      <div class="progress-panel">
        <div class="progress-status">${statusText}</div>
        <p class="progress-sub">${sub}</p>
        <div class="progress-elapsed" id="elapsed" data-since="${t.submittedAt || t.updatedAt}">${fmtElapsed(t.submittedAt || t.updatedAt)}</div>
        <div class="progress-track"><i></i></div>
      </div>
      <div class="meta-grid" style="margin-top:14px">
        <div class="meta-row"><span class="meta-key">提示词</span><span class="meta-val">${escapeHtml(t.prompt || '（无）')}</span></div>
        <div class="meta-row"><span class="meta-key">远程任务</span><span class="meta-val mono">${escapeHtml(t.remoteId || '提交中…')}</span></div>
      </div>
    </div>`;
}

function playerHtml(t) {
  const frame = t.videoPath
    ? `<div class="player-frame"><video src="${toMediaUrl(t.videoPath)}" controls playsinline preload="metadata"></video></div>`
    : `<div class="player-downloading">
         ${t.downloadError
           ? `视频下载未完成：${escapeHtml(t.downloadError)} <button class="btn btn-ghost btn-sm" data-action="redownload" style="margin-left:8px">${ICONS.refresh}重新下载</button>`
           : '视频已生成，正在下载到本地…'}
       </div>`;
  const urlRow = t.videoUrl
    ? `<div class="meta-row"><span class="meta-key">远程地址</span><span class="meta-val mono">${escapeHtml(t.videoUrl)}<button class="inline-btn" data-action="copy-url">复制</button></span></div>` : '';
  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">生成完成</h2>
          <div class="detail-sub">${escapeHtml(t.model)} · ${MODE_LABEL[t.mode] || t.mode} · ${escapeHtml(metaLine(t))} · ${fmtTime(t.updatedAt)} 完成</div>
        </div>
        ${badge(t)}
      </div>
      ${frame}
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-key">提示词</span><span class="meta-val">${escapeHtml(t.prompt || '（无）')}</span></div>
        <div class="meta-row"><span class="meta-key">远程任务</span><span class="meta-val mono">${escapeHtml(t.remoteId)}</span></div>
        <div class="meta-row"><span class="meta-key">本地文件</span><span class="meta-val mono">${t.videoPath ? escapeHtml(t.videoPath) : '—'}</span></div>
        ${urlRow}
        <div class="meta-row"><span class="meta-key">说明</span><span class="meta-val" style="color:var(--ink-faint);font-size:11.5px">远程地址 24 小时后失效，视频已保存到本地，可随时回看</span></div>
      </div>
      <div class="detail-actions" style="margin-top:4px">
        ${t.videoPath ? `<button class="btn btn-ghost" data-action="reveal">${ICONS.folder}${REVEAL_LABEL}</button>` : ''}
        ${t.videoPath ? `<button class="btn btn-ghost" data-action="open">${ICONS.external}用默认播放器打开</button>` : ''}
        <button class="btn btn-ghost" data-action="duplicate">${ICONS.copy}复制为新片段</button>
        <button class="btn btn-ghost btn-danger" data-action="remove">${ICONS.trash}删除片段</button>
      </div>
    </div>`;
}

/* ---------------- 编辑器 ---------------- */

/* 把 "768P ¥0.45/秒 · 2K ¥0.72/秒" 这类价格串解析成结构化价格单元。
   无分辨率前缀的裸价（如 "¥0.9/秒"）归入第一档分辨率（通常是该模型最低价档）；
   该档已有明确价格时则视为补充说明，不覆盖 */
function parsePricing(pricing, resolutions) {
  const text = (pricing || '').trim();
  if (!text) return { unit: '', cells: [], notes: [] };
  const unit = text.includes('/秒') ? '/秒' : (text.includes('百万') ? '/百万tokens' : '');
  const cells = [];
  const notes = [];
  const firstRes = resolutions && resolutions.length ? String(resolutions[0]).toUpperCase() : '';
  for (const seg of text.split('·')) {
    const hit = seg.match(/(\d{3,4}[Pp]|\d+[Kk])\s*[约≈]?\s*¥?\s*(\d+(?:\.\d+)?)/);
    if (hit) {
      cells.push({ res: hit[1].toUpperCase(), price: Number(hit[2]) });
      continue;
    }
    const bare = seg.match(/[约≈]?\s*¥\s*(\d+(?:\.\d+)?)/);
    if (bare && firstRes && !cells.some((c) => c.res === firstRes)) {
      cells.push({ res: firstRes, price: Number(bare[1]) });
      continue;
    }
    const note = seg.replace(/[约≈]?¥?\d+(?:\.\d+)?\s*\/?\s*(秒|百万\s*tokens?)?/g, '').trim();
    if (note) notes.push(note);
  }
  return { unit, cells, notes };
}

/* 贴纸行：最高画质(紫) + 时长(青) + 有声(粉) + 生成方式(白)——颜色即语义 */
function tagRowHtml(m) {
  const top = m.resolutions[m.resolutions.length - 1];
  const tags = [
    `<i class="tag tag-res" title="支持 ${escapeHtml(m.resolutions.join(' / '))}">${escapeHtml(top)}</i>`,
    `<i class="tag tag-dur">${m.durationAuto ? '智能 ' : ''}${m.duration[0]}–${m.duration[1]}s</i>`,
  ];
  if (m.audio) tags.push('<i class="tag tag-audio">有声</i>');
  const modes = Object.keys(MODE_CHAR).filter((k) => m.modes.includes(k)).map((k) => MODE_CHAR[k]).join('');
  tags.push(`<i class="tag tag-mode" title="${m.modes.map((k) => MODE_LABEL[k] || k).join(' / ')}">${modes}</i>`);
  return `<span class="tag-row">${tags.join('')}</span>`;
}

/* 费用预估：按秒计费的模型用 单价 × 时长 直接算；智能时长只报单价；token 计费提示浮动 */
function costEstimate(t, model, patch = {}) {
  const { unit, cells } = parsePricing(model.pricing, model.resolutions);
  if (!cells.length) return '';
  if (unit !== '/秒') return '按 token 计费，费用随输出浮动';
  const resolution = String(patch.resolution ?? t.resolution).toUpperCase();
  const duration = patch.duration !== undefined ? Number(patch.duration) : Number(t.duration);
  const cell = cells.find((c) => c.res === resolution);
  if (!cell) return '';
  if (duration === -1) return `¥${cell.price}/秒 · 智能时长`;
  if (!duration) return `¥${cell.price}/秒`;
  return `预估 ≈ ¥${(cell.price * duration).toFixed(2)}`;
}

function updateCostEstimate(patch = {}) {
  const el = $('#cost-estimate');
  if (!el) return;
  const t = getTask(state.selectedId);
  // 用 findModel：没有模型时就不该有费用数字，拿默认模型算一个出来是假信息
  const model = t && findModel(t.model);
  const text = t && model ? costEstimate(t, model, patch) : '';
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

/* 生成方式缩写 */
const MODE_CHAR = { text: '文', image: '图', reference: '参', edit: '编' };

/* ---------------- 模型选择器（渐进披露） ----------------
   默认只呈现当前模型；点开才是可搜索的完整列表。
   展开是内联的而不是浮层：#detail 是 overflow:auto 的滚动容器，
   绝对定位的浮层会被它裁掉（实测内容高 2303 / 可视 663）。 */

/* 模型名 / 厂商 / id / 能力一起参与匹配，让「参考」「字节」这类词也能搜到 */
function modelMatches(m, q) {
  if (!q) return true;
  const hay = [
    m.name, m.familyName, m.family, m.id, m.badge, m.desc,
    m.modes.map((k) => MODE_LABEL[k] || k).join(' '),
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

/* 按家族分组，保持目录里的首次出现顺序 */
function groupByFamily(models) {
  const families = [];
  for (const m of models) {
    let fam = families.find((f) => f.key === m.family);
    if (!fam) {
      fam = { key: m.family, name: m.familyName || m.family, items: [] };
      families.push(fam);
    }
    fam.items.push(m);
  }
  return families;
}

/* 列表行只给「起价」：完整档位价目留给折叠卡片，列表行才不会被撑成两行 */
function startPriceLabel(m) {
  const { unit, cells } = parsePricing(m.pricing, m.resolutions);
  if (!cells.length) return m.pricing ? '按量计费' : '';
  if (unit !== '/秒') return `¥${cells[0].price}/百万 tokens`;
  return `¥${Math.min(...cells.map((c) => c.price))}/秒起`;
}

function modelOptionHtml(m, selected, idx) {
  return `
    <button type="button" class="picker-opt ${selected ? 'is-selected' : ''}"
            id="opt-${idx}" role="option" aria-selected="${selected ? 'true' : 'false'}"
            data-model-pick="${escapeHtml(m.id)}">
      <span class="opt-dot" aria-hidden="true"></span>
      <span class="opt-name">${escapeHtml(m.name)}</span>
      <span class="opt-dur">${m.durationAuto ? '智能 ' : ''}${m.duration[0]}–${m.duration[1]}s</span>
      <span class="opt-price">${escapeHtml(startPriceLabel(m))}</span>
      <span class="opt-badge" title="${escapeHtml(m.badge || '')}">${m.badge ? escapeHtml(m.badge) : ''}</span>
    </button>`;
}

/* 列表本体单独成函数：搜索时只重绘它，不重绘整个编辑器——
   否则 <input> 会被重建，用户打一个字就失焦 */
function modelListHtml(t, query) {
  const q = (query || '').trim().toLowerCase();
  const families = groupByFamily(state.models.filter((m) => modelMatches(m, q)));
  if (!families.length) {
    return `
      <div class="picker-empty">
        <span>没有匹配「${escapeHtml(query.trim())}」的模型</span>
        <button type="button" class="btn btn-ghost btn-sm" data-picker-clear>清空搜索</button>
      </div>`;
  }
  let idx = 0;
  return families.map((fam) => `
    <div class="picker-group">
      <div class="picker-group-name">${famIcon(fam.key)}${escapeHtml(fam.name)}</div>
      ${fam.items.map((m) => modelOptionHtml(m, t.model === m.id, idx++)).join('')}
    </div>`).join('');
}

/* 只换列表内容，不碰搜索框 */
function refreshModelList() {
  const list = $('#model-list');
  if (!list) return;
  const t = getTask(state.selectedId);
  list.innerHTML = t ? modelListHtml(t, state.modelQuery) : '';
}

function pickerPanelHtml(t) {
  return `
    <div class="picker-panel">
      <div class="picker-search">
        <input type="text" id="model-search" data-model-search role="combobox"
               aria-expanded="true" aria-controls="model-list" aria-label="搜索模型"
               placeholder="搜索模型、厂商或能力…" autocomplete="off"
               value="${escapeHtml(state.modelQuery)}" />
      </div>
      <div class="picker-list" id="model-list" role="listbox" aria-label="模型列表">
        ${modelListHtml(t, state.modelQuery)}
      </div>
    </div>`;
}

/* 折叠卡片：当前模型的模型级信息（档位价目 / 简介 / 能力）。
   整块是热区，「更换模型」只是视觉提示，不必精确点到它。
   还没选模型时没有可折叠的东西：列表恒展开，卡片退化成一句引导，
   而且不做成 <button> —— 让它可点却点不动、「收起」是句谎话，不如老老实实是块说明 */
function modelPickerHtml(t) {
  const model = findModel(t.model);
  const open = state.modelPickerOpen || !model;
  const card = model ? `
      <button type="button" class="picker-current" data-picker-toggle
              aria-expanded="${open ? 'true' : 'false'}" aria-controls="model-list">
        <span class="picker-head">
          <span class="picker-icon" data-family="${escapeHtml(model.family)}">${famIcon(model.family)}</span>
          <span class="picker-name">${escapeHtml(model.name)}</span>
          ${model.badge ? `<span class="model-badge">${escapeHtml(model.badge)}</span>` : ''}
          <span class="picker-swap">${open ? '收起' : '更换模型'}<i class="caret" aria-hidden="true"></i></span>
        </span>
        ${model.pricing ? `<span class="picker-pricing">${escapeHtml(model.pricing)}</span>` : ''}
        ${model.desc ? `<span class="picker-desc">${escapeHtml(model.desc)}</span>` : ''}
        ${tagRowHtml(model)}
      </button>` : `
      <div class="picker-current is-unset">
        <span class="picker-head"><span class="picker-name">先选一个模型</span></span>
        <span class="picker-desc">生成方式、时长、分辨率、画面比例，都会按所选模型自己的能力和限制来组装。</span>
      </div>`;
  return `
    <div class="picker ${open ? 'is-open' : ''}">
      ${card}
      ${open ? pickerPanelHtml(t) : ''}
    </div>`;
}

function modeSegmentedHtml(t, model) {
  if (!model || model.modes.length <= 1) return '';
  return `
    <section class="editor-section">
      <span class="section-label">生成方式</span>
      <div class="segmented">
        ${model.modes.map((m) => `
          <button type="button" class="seg-btn ${t.mode === m ? 'active' : ''}" data-mode="${m}">${MODE_LABEL[m] || m}</button>`).join('')}
      </div>
    </section>`;
}

function durationChipsHtml(t, model) {
  const [min, max] = model.duration;
  const chips = [];
  if (model.durationAuto) {
    chips.push(`<button type="button" class="chip ${Number(t.duration) === -1 ? 'active' : ''}" data-value="-1">智能</button>`);
  }
  const quick = QUICK_DURATIONS.filter((d) => d >= min && d <= max).slice(0, 5);
  for (const d of quick) {
    chips.push(`<button type="button" class="chip ${Number(t.duration) === d ? 'active' : ''}" data-value="${d}">${d}s</button>`);
  }
  return chips.join('');
}

/* 参数区住在编辑器右栏：每一组独占一行，「标签在左、控件在右」。
   左栏那张大卡片式的排版（16px 加粗标题 + 下划线 + 24px 内边距）在这里是负担 ——
   一个 39px 高的分段控件顶着 138px 的卡片，标题比内容还重 */
function paramsHtml(t, model) {
  const [min, max] = model.duration;
  const durationVal = Number(t.duration) === -1 ? '' : t.duration;
  const adaptiveHint = (t.mode === 'image' || t.mode === 'edit') && t.ratio === 'adaptive'
    ? '<span class="hint accent">比例自适应：输出宽高比将跟随输入素材</span>' : '';
  const autoHint = model.durationAuto && Number(t.duration) === -1
    ? '<span class="hint">智能时长：由模型根据内容自动决定</span>' : '';
  const audioRow = model.audio ? `
      <div class="param-row">
        <span class="param-label">有声视频</span>
        <div class="toggle-row">
          <button type="button" class="toggle" role="switch" aria-checked="${t.audio ? 'true' : 'false'}" data-field="audio" aria-label="有声视频开关"></button>
          <span class="toggle-label">${t.audio ? '开启' : '关闭'}</span>
        </div>
      </div>` : '';
  return `
    <section class="editor-section">
      <span class="section-label">参数</span>
      <div class="param-row">
        <span class="param-label">时长<span class="param-note">${min}–${max}s</span></span>
        <div class="chips" data-field="duration">
          ${durationChipsHtml(t, model)}
          <input type="number" id="f-duration" min="${min}" max="${max}" value="${durationVal}" placeholder="${model.durationAuto ? '智能' : ''}" />
        </div>
        ${autoHint}
      </div>
      <div class="param-row">
        <span class="param-label">分辨率</span>
        <div class="chips" data-field="resolution">
          ${model.resolutions.map((r) => `<button type="button" class="chip ${t.resolution === r ? 'active' : ''}" data-value="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('')}
        </div>
      </div>
      <div class="param-row">
        <span class="param-label">画面比例</span>
        <div class="chips" data-field="ratio">
          ${model.ratios.map((r) => `<button type="button" class="chip ${t.ratio === r ? 'active' : ''}" data-value="${escapeHtml(r)}">${ratioLabel(r)}</button>`).join('')}
        </div>
        ${adaptiveHint}
      </div>
      ${audioRow}
    </section>`;
}

function mediaSlotHtml(t, key, label, kind, required, urlOnly = false) {
  const m = t.media && t.media[key];
  const req = required ? '<span class="media-required">必填</span>' : '';
  let body;
  if (m && m.source === 'local') {
    const thumb = kind === 'image' ? `<img class="media-thumb" src="${toMediaUrl(m.path)}" alt="" />` : '';
    body = `
      <div class="media-filled">
        ${thumb}
        <span class="media-name" title="${escapeHtml(m.path)}">${escapeHtml(m.name || m.path)}</span>
        <button class="icon-btn" data-media-clear="${key}" title="移除">${ICONS.trash}</button>
      </div>`;
  } else if (m && m.source === 'url') {
    body = `
      <div class="media-filled">
        <span class="media-name" title="${escapeHtml(m.url)}">${escapeHtml(m.url)}</span>
        <button class="icon-btn" data-media-clear="${key}" title="移除">${ICONS.trash}</button>
      </div>`;
  } else {
    const kindLabel = kind === 'image' ? '图片' : kind === 'video' ? '视频' : '音频';
    const icon = kind === 'image' ? ICONS.image : kind === 'video' ? ICONS.video : ICONS.music;
    body = `
      <div class="media-empty">
        ${urlOnly ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-media-pick="${key}" data-kind="${kind}">${icon}选择本地文件</button><span class="media-or">或</span>`}
        <input type="url" class="url-input" data-media-url="${key}" placeholder="粘贴${kindLabel} URL，回车确认" spellcheck="false" />
      </div>`;
  }
  return `
    <div class="media-slot">
      <div class="media-slot-head"><span class="media-slot-title">${label}${req}</span></div>
      ${body}
    </div>`;
}

function refImagesHtml(t, model) {
  const refs = (t.media && t.media.refImages) || [];
  const max = model.maxRefImages || Infinity;
  const items = refs.map((m, i) => {
    const inner = m.source === 'local'
      ? `<img src="${toMediaUrl(m.path)}" alt="" />`
      : `<span class="ref-url-tag">${escapeHtml(m.url)}</span>`;
    return `
      <div class="ref-item" title="${escapeHtml(m.source === 'local' ? m.path : m.url)}">
        ${inner}
        <button type="button" class="ref-remove" data-ref-remove="${i}" title="移除">${ICONS.x}</button>
      </div>`;
  }).join('');
  const canAdd = refs.length < max;
  const addRow = canAdd ? `
    <div class="media-empty">
      <button type="button" class="btn btn-ghost btn-sm" data-ref-add="local">${ICONS.image}添加本地图片</button>
      <span class="media-or">或</span>
      <input type="url" class="url-input" data-ref-add="url" placeholder="粘贴图片 URL，回车添加" spellcheck="false" />
    </div>` : '';
  const limitHint = max !== Infinity
    ? `<span class="hint">最多 ${max} 张参考图（当前 ${refs.length} 张）</span>` : '';
  return `
    <div class="media-slot">
      <div class="media-slot-head"><span class="media-slot-title">参考图片</span></div>
      ${refs.length ? `<div class="ref-grid">${items}</div>` : ''}
      ${addRow}
      ${limitHint}
    </div>`;
}

function mediaSectionHtml(t, model) {
  if (t.mode === 'image') {
    return `
      <section class="editor-section">
        <span class="section-label">帧图片</span>
        <div class="media-grid">
          ${mediaSlotHtml(t, 'firstFrame', '首帧图片', 'image', true)}
          ${mediaSlotHtml(t, 'lastFrame', '尾帧图片（可选）', 'image', false)}
        </div>
        <span class="hint">支持选择本地图片，或直接粘贴可公开访问的图片 URL；宽高比可在下方固定或设为自适应</span>
      </section>`;
  }
  // 下面两组素材块都进同一个 .media-grid：横向铺开后才不会一块压着一块往下摞。
  // 参考图那一块允许有多张缩略图，高度天然比 URL 输入框高，让它占第一格
  if (t.mode === 'reference') {
    return `
      <section class="editor-section">
        <span class="section-label">参考素材</span>
        <div class="media-grid">
          ${refImagesHtml(t, model)}
          ${model.refImagesOnly ? '' : mediaSlotHtml(t, 'refVideo', '参考视频（仅 URL）', 'video', false, true)}
          ${model.refImagesOnly ? '' : mediaSlotHtml(t, 'refAudio', '参考音频（仅 URL）', 'audio', false, true)}
        </div>
        <span class="hint">${model.refImagesOnly ? '至少添加一张参考图片' : '参考图片与参考视频至少提供一项，可自由组合'}</span>
      </section>`;
  }
  if (t.mode === 'edit') {
    return `
      <section class="editor-section">
        <span class="section-label">编辑素材</span>
        <div class="media-grid">
          ${mediaSlotHtml(t, 'editVideo', '源视频（仅 URL）', 'video', true, true)}
          ${refImagesHtml(t, model)}
        </div>
        <span class="hint">源视频为待编辑的原始片段；参考图可选，用于风格 / 主体替换</span>
      </section>`;
  }
  return '';
}

/* 模型区块（标签 + 同步按钮 + 选择器）。选没选模型都要出现，抽出来给两种骨架共用 */
function modelSectionHtml(t) {
  return `
    <section class="editor-section">
      <span class="section-label">模型<span class="section-note sync-note"><span id="sync-status">${syncStatusText()}</span><button type="button" class="icon-btn sync-refresh ${state.modelSyncing ? 'spinning' : ''}" data-action="sync-models" title="同步模型目录" ${state.modelSyncing ? 'disabled' : ''}>${ICONS.refresh}</button></span></span>
      ${modelPickerHtml(t)}
    </section>`;
}

/* 底部操作条。跟文档流走、不做 sticky —— 悬浮会盖住它下面的内容。
   没有可用模型时「开始生成」是禁用的，否则点下去只会换来一句报错 */
function editorFootHtml(t, cost) {
  const ready = !!findModel(t.model);
  return `
    <div class="editor-foot">
      <div class="foot-left">
        <span class="cost-estimate ${cost ? '' : 'hidden'}" id="cost-estimate">${escapeHtml(cost)}</span>
        <span class="save-state" id="save-state">${ready ? '更改会自动保存' : '选定模型后即可配置参数'}</span>
      </div>
      <div class="foot-actions">
        <button class="btn btn-ghost btn-danger" data-action="remove">${ICONS.trash}删除</button>
        <button class="btn btn-primary" data-action="submit"
                ${ready ? `title="开始生成（${MOD_HINT}⏎）"` : 'disabled title="请先选择模型"'}
        >${ICONS.play}开始生成</button>
      </div>
    </div>`;
}

function editorHtml(t) {
  const model = findModel(t.model);

  const failedBanner = t.status === 'failed' && t.error
    ? `<div class="form-error">${ICONS.alert}<div><strong>上次提交失败</strong><br>${escapeHtml(t.error)}</div></div>` : '';

  // 没有可用模型时只出「模型选择区 + 底部操作」，不摆任何表单控件。
  // 生成方式 / 提示词 / 素材 / 参数全都取决于具体模型的能力，先摆一排还不知道自己会变成
  // 什么样的控件，只会让人猜不透；等模型定了再组装，表单才有确定的含义。
  // 两种情形共用这套骨架：还没选过模型（空串），以及选过的模型已不在目录里。
  if (!model) {
    const notice = t.model
      ? `<div class="form-error form-warn">${ICONS.alert}<div><strong>模型已下线</strong><br>该片段使用的模型 ${escapeHtml(t.model)} 已不在当前目录中，请重新选择一个模型。</div></div>`
      : '';
    return `
      <div class="detail-inner">
        <div class="detail-head">
          <div>
            <h2 class="detail-title">${t.status === 'failed' ? '修改后重新提交' : '新建片段'}</h2>
            <div class="detail-sub">${escapeHtml(t.model || '未选择模型')} · 创建于 ${fmtTime(t.createdAt)}</div>
          </div>
          ${badge(t)}
        </div>
        ${failedBanner}
        ${notice}
        ${modelSectionHtml(t)}
        ${editorFootHtml(t, '')}
      </div>`;
  }

  const promptLabel = t.mode === 'edit' ? '编辑指令' : '提示词';
  const promptPlaceholder = t.mode === 'edit'
    ? '描述希望对源视频做的修改，例如：把画面转为水彩风格，保留人物动作'
    : '描述想要的画面、动作与镜头语言，例如：女人坐在咖啡馆里抬头看向窗外，镜头推进拍到街道，暖色调';
  const promptLen = (t.prompt || '').trim().length;
  const cost = costEstimate(t, model);

  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">${t.status === 'failed' ? '修改后重新提交' : '新建片段'}</h2>
          <div class="detail-sub">${escapeHtml(t.model)} · 创建于 ${fmtTime(t.createdAt)}</div>
        </div>
        ${badge(t)}
      </div>
      ${failedBanner}
      <div class="editor-cols">
        <!-- 左栏：写内容。模型与提示词都在这儿，宽度按「要读要写」的需求给 -->
        <div class="editor-main">
          ${modelSectionHtml(t)}
          <section class="editor-section">
            <span class="section-label">${promptLabel}<span class="section-note" id="prompt-count">${promptLen ? `${promptLen} 字` : ''}</span></span>
            <textarea class="prompt-input" id="f-prompt" placeholder="${promptPlaceholder}">${escapeHtml(t.prompt)}</textarea>
          </section>
        </div>
        <!-- 右栏：调参数。这几组控件都是「看一眼、点一下」的短停留操作，
             竖着排成控制条，比横铺成三列卡片更省纵向空间，也更好扫 -->
        <aside class="editor-side">
          ${modeSegmentedHtml(t, model)}
          ${paramsHtml(t, model)}
          <!-- 提交条沉在右栏底部：它往上贴着参数区的话，
               右下角会空出一大块没人用的地方 -->
          ${editorFootHtml(t, cost)}
        </aside>
        <!-- 素材接在左栏下方（右栏跨两行，所以它只占左栏那一列）。
             它按模式出现、块数不定，横铺开才有地方并排 —— 竖着摞的话，
             参考生视频与视频编辑这两种最重的模式会把整页顶出屏幕 -->
        ${mediaSectionHtml(t, model)}
      </div>
    </div>`;
}

async function patchMedia(t, key, value) {
  const media = { ...(t.media || {}) };
  if (value) media[key] = value;
  else delete media[key];
  try {
    await flushSave(t);
    const updated = await studio.updateTask(t.id, { media });
    mergeTask(updated);
    renderDetail(true);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function patchRefImages(t, updater) {
  const media = { ...(t.media || {}) };
  const refs = [...(media.refImages || [])];
  const next = updater(refs);
  if (next.length) media.refImages = next;
  else delete media.refImages;
  try {
    await flushSave(t);
    const updated = await studio.updateTask(t.id, { media });
    mergeTask(updated);
    renderDetail(true);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function validateForSubmit(t) {
  // 没有可用模型，后面按 t.mode 分的规则全都无从谈起（t.mode 此时是空的）
  if (!t.model) return '请先为该片段选择模型';
  if (!findModel(t.model)) return '该片段使用的模型已下线，请重新选择模型';
  const m = t.media || {};
  const prompt = (t.prompt || '').trim();
  if (t.mode === 'text' && !prompt) return '文生视频需要填写提示词';
  if (t.mode === 'image' && !m.firstFrame) return '图生视频需要至少一张首帧图片';
  if (t.mode === 'reference') {
    if (!(m.refImages && m.refImages.length) && !m.refVideo) return '参考生视频至少需要参考图片或参考视频';
  }
  if (t.mode === 'edit') {
    if (!m.editVideo) return '视频编辑需要一段源视频（URL）';
    if (!prompt) return '视频编辑需要填写编辑指令';
  }
  return '';
}

/* ---------------- 任务操作 ---------------- */

/* 把一张任务载入创作台。切换工单时清掉模型选择器的展开态与搜索词，
   否则上一张工单的搜索词会被带进新工单 */
function loadIntoStudio(id) {
  state.selectedId = id;
  state.modelPickerOpen = false;
  state.modelQuery = '';
  switchTab('studio');
  renderStudio(true);
  const input = $('#model-search');
  if (input) input.focus();
}

/* 新建工单不预置模型：先让用户选，表单再按该模型的能力组装出来。
   连带去掉了「记住上次用的模型」—— 预选会让表单在用户还没选之前就长出来，
   与这个交互直接矛盾（原 lastModel/rememberModel 随之成为死代码，一并删除） */
async function newTask() {
  // 草稿不在作品墙上，攒多了用户根本找不到，所以「一次只配一段」：
  // 已经有一张没提交的，就把它推到眼前，而不是再建一个空壳
  const draft = state.tasks.find((t) => t.status === 'draft');
  if (draft) {
    loadIntoStudio(draft.id);
    showToast('创作台已有一张未提交的工单');
    return;
  }
  try {
    const task = await studio.createTask({});
    mergeTask(task);
    loadIntoStudio(task.id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function duplicateTask(id) {
  try {
    const task = await studio.duplicateTask(id);
    mergeTask(task);
    closeWorkModal();
    loadIntoStudio(task.id);
    showToast('已复制为新工单', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeTask(id) {
  const t = getTask(id);
  if (t && t.videoPath) {
    const okDel = window.confirm('删除该片段会同时删除已下载到本地的视频文件，且不可恢复。确定删除？');
    if (!okDel) return;
  }
  try {
    await studio.removeTask(id);
    state.tasks = state.tasks.filter((x) => x.id !== id);
    // 不再兜底选中别的任务：删掉工单就该回到走马灯，而不是莫名跳进另一段的编辑器
    if (state.selectedId === id) state.selectedId = null;
    if (state.modalId === id) closeWorkModal();
    renderDetail(true);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitOne(id) {
  const t = getTask(id);
  if (!t) return;
  if (id === state.selectedId) await flushSave(t);
  const fresh = getTask(id);
  const problem = validateForSubmit(fresh);
  if (problem) {
    loadIntoStudio(id);
    showToast(problem, 'error');
    return;
  }
  try {
    const submitted = await studio.submitTask(id);
    mergeTask(submitted);
    if (submitted.status === 'failed') {
      showToast(submitted.error || '提交失败', 'error');
      loadIntoStudio(id);   // 失败了要留在编辑器里改
    } else {
      finishOrder(id);
      showToast('已提交，开始生成', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* 工单交出去了就不再占着编辑器：创作台回到走马灯，
   此刻它正好承担「这一单已下达，要再开一单吗」的语义 */
function finishOrder(id) {
  if (state.selectedId === id) state.selectedId = null;
  renderDetail(true);
}

/* ---------------- 详情区统一事件委托 ---------------- */

async function handleDetailAction(t, action, btn) {
  switch (action) {
    case 'new':
      await newTask();
      break;
    case 'sync-models':
      await refreshModels(true);
      break;
    case 'duplicate':
      if (t) await duplicateTask(t.id);
      break;
    case 'remove':
      if (t) await removeTask(t.id);
      break;
    case 'submit': {
      if (!t) return;
      btn.disabled = true;
      try {
        await flushSave(t);
        const fresh = getTask(t.id);
        const problem = validateForSubmit(fresh);
        if (problem) {
          showToast(problem, 'error');
          return;
        }
        const submitted = await studio.submitTask(t.id);
        mergeTask(submitted);
        if (submitted.status === 'failed') showToast(submitted.error || '提交失败', 'error');
        else {
          finishOrder(t.id);
          showToast('已提交，开始生成', 'success');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
      break;
    }
    case 'credit': {
      // 失败的任务可以回到编辑器改。succeeded/cancelled/expired 不行 ——
      // main/tasks.js 的 update() 只放行 draft 与 failed，给了按钮也只会报错
      if (!t || t.status !== 'failed') return;
      closeWorkModal();
      loadIntoStudio(t.id);
      break;
    }
    case 'open-work': {
      const card = btn && btn.closest('.work-card');
      if (card) openWorkModal(card.dataset.id);
      break;
    }
    case 'go-studio':
      switchTab('studio');
      break;
    case 'filter-all':
      state.filter = 'all';
      renderWall(true);
      break;
    case 'reveal':
      if (t && t.videoPath) await studio.revealVideo(t.videoPath);
      break;
    case 'open':
      if (t && t.videoPath) await studio.openVideo(t.videoPath);
      break;
    case 'copy-url':
      if (t && t.videoUrl) {
        await navigator.clipboard.writeText(t.videoUrl);
        showToast('远程地址已复制', 'success');
      }
      break;
    case 'redownload':
      if (t) {
        try {
          const updated = await studio.redownloadTask(t.id);
          mergeTask(updated);
          renderDetail();
          renderWorkModal(true);
          if (updated && updated.downloadError) showToast(updated.downloadError, 'error');
          else if (updated && updated.videoPath) showToast('视频已重新下载到本地', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
      break;
    default:
      break;
  }
}

function bindDetailEvents() {
  const box = $('#detail');

  box.addEventListener('click', async (e) => {
    // 作品墙有自己的委托（bindWallEvents）。不在这里挡掉的话，
    // 墙上的按钮会拿到创作台的当前工单 —— 删错、复制错
    if (e.target.closest('#panel-wall')) return;

    const t = getTask(state.selectedId);

    const pickToggle = e.target.closest('[data-picker-toggle]');
    if (pickToggle && t && editable(t)) {
      state.modelPickerOpen = !state.modelPickerOpen;
      if (!state.modelPickerOpen) state.modelQuery = '';   // 收起即清搜索，下次展开是干净列表
      renderDetail(true);
      if (state.modelPickerOpen) {
        const input = $('#model-search');
        if (input) input.focus();
      }
      return;
    }

    const pickClear = e.target.closest('[data-picker-clear]');
    if (pickClear) {
      state.modelQuery = '';
      refreshModelList();
      const input = $('#model-search');
      if (input) { input.value = ''; input.focus(); }
      return;
    }

    const modelOpt = e.target.closest('[data-model-pick]');
    if (modelOpt && t && editable(t)) {
      const id = modelOpt.dataset.modelPick;
      state.modelPickerOpen = false;
      state.modelQuery = '';
      if (id === t.model) { renderDetail(true); return; }
      try {
        await flushSave(t);
        const updated = await studio.updateTask(t.id, { model: id });
        mergeTask(updated);
        renderDetail(true);
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    const modeBtn = e.target.closest('[data-mode]');
    if (modeBtn && t && editable(t)) {
      try {
        await flushSave(t);
        const updated = await studio.updateTask(t.id, { mode: modeBtn.dataset.mode });
        mergeTask(updated);
        renderDetail(true);
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    const chip = e.target.closest('.chip[data-value]');
    if (chip && t && editable(t)) {
      const field = chip.parentElement.dataset.field;
      const value = field === 'duration' ? Number(chip.dataset.value) : chip.dataset.value;
      chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const num = $('#f-duration');
      if (field === 'duration' && num) num.value = Number(chip.dataset.value) === -1 ? '' : chip.dataset.value;
      scheduleSave(t, { [field]: value });
      updateCostEstimate({ [field]: value });
      await flushSave(t);
      return;
    }

    const toggle = e.target.closest('.toggle[data-field="audio"]');
    if (toggle && t && editable(t)) {
      const next = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', next ? 'true' : 'false');
      const label = toggle.parentElement.querySelector('.toggle-label');
      if (label) label.textContent = next ? '开启' : '关闭';
      scheduleSave(t, { audio: next });
      await flushSave(t);
      return;
    }

    const pickBtn = e.target.closest('[data-media-pick]');
    if (pickBtn && t && editable(t)) {
      const key = pickBtn.dataset.mediaPick;
      try {
        const file = await studio.pickMedia(pickBtn.dataset.kind);
        if (file) await patchMedia(t, key, { source: 'local', path: file.path, name: file.name });
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const clearBtn = e.target.closest('[data-media-clear]');
    if (clearBtn && t && editable(t)) {
      await patchMedia(t, clearBtn.dataset.mediaClear, null);
      return;
    }

    const refAddBtn = e.target.closest('[data-ref-add="local"]');
    if (refAddBtn && t && editable(t)) {
      try {
        const file = await studio.pickMedia('image');
        if (file) {
          await patchRefImages(t, (refs) => [...refs, { source: 'local', path: file.path, name: file.name }]);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const refRemove = e.target.closest('[data-ref-remove]');
    if (refRemove && t && editable(t)) {
      const idx = Number(refRemove.dataset.refRemove);
      await patchRefImages(t, (refs) => refs.filter((_, i) => i !== idx));
      return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) await handleDetailAction(t, actionBtn.dataset.action, actionBtn);
  });

  box.addEventListener('input', (e) => {
    // 搜索走局部重绘：整个编辑器重绘会把 <input> 一起重建，打一个字就失焦
    if (e.target.closest('[data-model-search]')) {
      state.modelQuery = e.target.value;
      refreshModelList();
      return;
    }
    const t = getTask(state.selectedId);
    if (!t || !editable(t)) return;
    if (e.target.id === 'f-prompt') {
      scheduleSave(t, { prompt: e.target.value });
      const counter = $('#prompt-count');
      if (counter) {
        const n = e.target.value.trim().length;
        counter.textContent = n ? `${n} 字` : '';
      }
    } else if (e.target.id === 'f-duration') {
      if (e.target.value === '') {
        const m = getModel(t.model);
        if (m && m.durationAuto) scheduleSave(t, { duration: -1 });
        updateCostEstimate({ duration: -1 });
      } else {
        scheduleSave(t, { duration: e.target.value });
        updateCostEstimate({ duration: Number(e.target.value) });
      }
    }
  });

  box.addEventListener('change', (e) => {
    const t = getTask(state.selectedId);
    if (!t || !editable(t)) return;
    const urlInput = e.target.closest('[data-media-url]');
    if (urlInput) {
      const url = urlInput.value.trim();
      if (url) patchMedia(t, urlInput.dataset.mediaUrl, { source: 'url', url });
      return;
    }
    const refUrl = e.target.closest('[data-ref-add="url"]');
    if (refUrl) {
      const url = refUrl.value.trim();
      if (url) patchRefImages(t, (refs) => [...refs, { source: 'url', url }]);
      return;
    }
    if (e.target.id === 'f-duration') {
      const m = getModel(t.model);
      const allowAuto = m && m.durationAuto;
      const val = e.target.value === '' ? (allowAuto ? -1 : NaN) : Number(e.target.value);
      if (!Number.isNaN(val)) {
        document.querySelectorAll('[data-field="duration"] .chip').forEach((c) => {
          c.classList.toggle('active', Number(c.dataset.value) === val);
        });
      }
    }
  });

  // 搜索框里的键盘导航。焦点始终留在 input 上，靠 .is-active + aria-activedescendant
  // 标示当前项（WAI-ARIA combobox 模式），不用把焦点搬到 option 上
  box.addEventListener('keydown', (e) => {
    const input = e.target.closest('[data-model-search]');
    if (!input) return;
    const opts = [...document.querySelectorAll('#model-list .picker-opt')];

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!opts.length) return;
      const cur = opts.findIndex((o) => o.classList.contains('is-active'));
      const next = e.key === 'ArrowDown'
        ? (cur + 1) % opts.length
        : (cur <= 0 ? opts.length - 1 : cur - 1);
      opts.forEach((o, i) => o.classList.toggle('is-active', i === next));
      input.setAttribute('aria-activedescendant', opts[next].id);
      opts[next].scrollIntoView({ block: 'nearest' });
      return;
    }

    // 带修饰键的 Enter 留给全局的「提交」快捷键，不要在这里截胡
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const pick = opts.find((o) => o.classList.contains('is-active')) || opts[0];
      if (pick) pick.click();
      return;
    }

    if (e.key === 'Escape') {
      // 面板里的 Esc 只收起面板：全局那条 Esc（关弹窗/引导）不应被连累
      e.stopPropagation();
      state.modelPickerOpen = false;
      state.modelQuery = '';
      renderDetail(true);
      const back = $('[data-picker-toggle]');
      if (back) back.focus();
    }
  });
}

/* ---------------- 设置 ---------------- */

let oauthBusy = false;

function setOauthUI(busy) {
  oauthBusy = busy;
  const btn = $('#btn-oauth-connect');
  btn.disabled = false; // 授权中再点一次 = 取消
  btn.classList.toggle('oauth-pending', busy);
  $('#oauth-btn-text').textContent = busy ? '等待浏览器授权…（点击取消）' : '一键授权，自动填入 Key';
}

async function openSettings() {
  const s = state.settings || await studio.getSettings();
  $('#set-endpoint').value = s.endpoint || '';
  $('#set-apikey').value = s.apiKey || '';
  $('#set-apikey').type = 'password';
  $('#set-toggle-key').textContent = '显示';
  $('#test-result').textContent = '';
  $('#test-result').className = 'test-result';
  // 每次打开都重新拉一次版本（启动态用户切分支/script 也能看到当前真实版本）
  if (!state.appInfo) {
    try { state.appInfo = await studio.getAppInfo(); } catch { /* 留空也能用 */ }
  }
  paintAppVersion();
  // 进入设置时把上一次的更新结果清掉，避免旧提示混在新一次结果里
  $('#update-result').innerHTML = '';
  $('#update-result').className = 'update-result';
  $('#settings-modal').classList.remove('hidden');
}

function paintAppVersion() {
  const info = state.appInfo || {};
  $('#app-version').textContent = info.version ? `v${info.version}` : '未知';
  const ch = $('#app-channel');
  if (info.isElectron === false) {
    ch.textContent = '开发态（npm start）';
    ch.title = '当前以源码方式运行，自动更新下载的安装包不适用，请用 git pull 拉取最新代码';
  } else if (info.isElectron === true) {
    ch.textContent = '桌面端';
    ch.title = '';
  } else {
    ch.textContent = '';
  }
}

function closeSettings() {
  if (oauthBusy) {
    studio.cancelConnect().catch(() => {});
    setOauthUI(false);
  }
  $('#settings-modal').classList.add('hidden');
  // 首启流程：设置关闭后接力新手引导
  if (tourPending) {
    tourPending = false;
    if (!tourSeen()) startTour();
  }
}

function bindSettings() {
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-settings-close').addEventListener('click', closeSettings);
  $('#settings-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  $('#set-toggle-key').addEventListener('click', () => {
    const input = $('#set-apikey');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#set-toggle-key').textContent = show ? '隐藏' : '显示';
  });
  $('#btn-oauth-connect').addEventListener('click', async () => {
    if (oauthBusy) {
      try { await studio.cancelConnect(); } catch { /* 忽略 */ }
      setOauthUI(false);
      return;
    }
    setOauthUI(true);
    try {
      await studio.connectTokenDance();
      state.settings = await studio.getSettings();
      $('#set-apikey').value = state.settings.apiKey || '';
      showToast('授权成功，API Key 已自动填入并保存', 'success');
      refreshConnStatus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setOauthUI(false);
    }
  });
  $('#btn-test-conn').addEventListener('click', async () => {
    const result = $('#test-result');
    result.textContent = '测试中…';
    result.className = 'test-result';
    try {
      const r = await studio.testSettings({
        endpoint: $('#set-endpoint').value.trim(),
        apiKey: $('#set-apikey').value.trim(),
      });
      result.textContent = r.message;
      result.className = `test-result ${r.ok ? 'ok' : 'bad'}`;
    } catch (err) {
      result.textContent = err.message;
      result.className = 'test-result bad';
    }
  });
  $('#btn-settings-save').addEventListener('click', async () => {
    try {
      state.settings = await studio.saveSettings({
        endpoint: $('#set-endpoint').value.trim(),
        apiKey: $('#set-apikey').value.trim(),
      });
      closeSettings();
      showToast('设置已保存', 'success');
      refreshConnStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  /* ---- 检查更新 ---- */
  $('#btn-check-update').addEventListener('click', onCheckUpdate);
}

function formatBytes(n) {
  if (!n || n < 1024) return n ? `${n} B` : '';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// 把 GitHub release body 里的 markdown 噪声压一压再展示。
// 不做完整渲染（不想引第三方 markdown 库，也不想写解析器），只去掉最常见的：
//   - 标题前后的 # 符号
//   - 引用、列表项、无序列表符号
//   - 多余空行合并
// 目的：看起来没那么糙，够用就行。
function flattenReleaseNotes(s) {
  if (!s) return '';
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line
      .replace(/^#{1,6}\s*/, '')   // # ## ### 标题符
      .replace(/^>\s*/, '')        // > 引用
      .replace(/^[-*+]\s+/, '· ')  // 无序列表
      .replace(/^\d+\.\s+/, '· '), // 有序列表
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paintUpdateResult(data) {
  const box = $('#update-result');
  box.innerHTML = '';
  if (data.hasUpdate) {
    const date = data.publishedAt ? new Date(data.publishedAt) : null;
    const dateStr = date && !isNaN(date) ? date.toISOString().slice(0, 10) : '';
    box.className = 'update-result has-update';
    const notes = flattenReleaseNotes(data.releaseNotes);
    box.innerHTML = `
      <div class="update-headline">发现新版本 <strong>v${escapeHtml(data.latest)}</strong>${dateStr ? ` <span class="update-date">（${dateStr}）</span>` : ''}</div>
      ${notes ? `<pre class="update-notes">${escapeHtml(notes)}</pre>` : ''}
      <div class="update-actions">
        <a class="btn btn-primary btn-sm" href="${escapeHtml(data.downloadUrl)}" target="_blank" rel="noopener noreferrer">前往下载</a>
        ${data.fileName ? `<span class="update-meta">${escapeHtml(data.fileName)}${data.fileSize ? ` · ${formatBytes(data.fileSize)}` : ''}</span>` : ''}
        ${data.releaseUrl ? `<a class="update-meta-link" href="${escapeHtml(data.releaseUrl)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看</a>` : ''}
      </div>
    `;
  } else {
    box.className = 'update-result ok';
    // 没有新版时显示「当前版本」而不是「最新 Release 的版本号」：
    // 本地跑的是比最新 Release 还新的开发版时（latest < current），
    // 后者会在版本行写着 v0.2.0、下面一行却说「已是最新版本 v0.1.0」
    box.innerHTML = `<div class="update-headline">已是最新版本 <strong>v${escapeHtml(data.current || data.latest)}</strong></div>`;
  }
}

function paintUpdateError(message) {
  const box = $('#update-result');
  box.className = 'update-result bad';
  box.innerHTML = `<div class="update-headline">检查失败：${escapeHtml(message)}</div>`;
}

async function onCheckUpdate() {
  if (state.updateCheckBusy) return;
  const btn = $('#btn-check-update');
  const result = $('#update-result');
  state.updateCheckBusy = true;
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '检查中…';
  result.className = 'update-result busy';
  result.textContent = '正在连接 GitHub…';
  try {
    const data = await studio.checkUpdate();
    paintUpdateResult(data);
  } catch (err) {
    paintUpdateError(err.message || String(err));
  } finally {
    state.updateCheckBusy = false;
    btn.disabled = false;
    btn.textContent = orig;
  }
}

/* ---------------- 网关状态灯 ---------------- */

async function refreshConnStatus() {
  const btn = $('#btn-conn');
  if (!btn) return;
  const set = (cls, label, tip) => {
    btn.className = `conn-status ${cls}`;
    btn.querySelector('span').textContent = label;
    btn.title = tip;
  };
  if (!state.settings || !state.settings.apiKey) {
    set('nokey', '未配置', '尚未配置 API Key，点击打开设置');
    return;
  }
  set('testing', '检测中', '正在检测网关连接…');
  try {
    const res = await studio.testSettings();
    if (res && res.ok) set('ok', '已连接', `${res.message} · 点击打开设置`);
    else set('bad', '连不通', `${(res && res.message) || '连接失败'} · 点击打开设置`);
  } catch (err) {
    set('bad', '连不通', `${err.message} · 点击打开设置`);
  }
}

/* ---------------- 全局事件 ---------------- */

function bindGlobal() {
  $('#btn-new').addEventListener('click', newTask);
  $('#btn-theme').addEventListener('click', cycleTheme);
  $('#btn-conn').addEventListener('click', openSettings);
  $('#btn-help').addEventListener('click', startTour);

  // 快捷键提示写进按钮 tooltip
  $('#btn-new').title = `新建工单（${MOD_HINT}N）`;
  $('#btn-settings').title = `设置（${MOD_HINT},）`;

  // tab 栏：切换只改可见性，不重建 DOM（作品墙的 scrollTop 与封面视频因此得以保留）
  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) switchTab(tab.dataset.tab);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tourRoot) { endTour(); return; }
      // 弹层排在设置前面：反过来会出现「弹层开着按 Esc 没反应」
      if (state.modalId) { closeWorkModal(); return; }
      closeSettings();
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'n') {
      e.preventDefault();
      newTask();
    } else if (key === 'enter') {
      // 弹层开着时不要穿透到背后的工单
      if (state.modalId) return;
      const t = currentOrder();
      if (t) {
        e.preventDefault();
        submitOne(t.id);
      }
    } else if (key === ',') {
      e.preventDefault();
      openSettings();
    }
  });

  // 只改文本，不触发任何重渲染 —— 作品墙与弹层里的计时共用它。
  // 一旦在这里调 renderWall()，标题栏的秒数就会变成每秒重载一次封面视频
  setInterval(() => {
    document.querySelectorAll('[data-since]').forEach((el) => {
      el.textContent = fmtElapsed(Number(el.dataset.since));
    });
  }, 1000);
}

/* 作品墙的事件委托。挂在自己身上而不是并入 bindDetailEvents：
   墙是 #detail 的子节点，两边共用一个处理器会让墙上的按钮认错任务 */
function bindWallEvents() {
  const wall = $('#panel-wall');
  if (!wall) return;

  wall.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) {
      if (chip.dataset.filter === state.filter) return;
      state.filter = chip.dataset.filter;
      renderWall(true);
      return;
    }
    const card = e.target.closest('.work-card');
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      await handleDetailAction(card ? getTask(card.dataset.id) : null, actionBtn.dataset.action, actionBtn);
      return;
    }
    // 点卡片任意位置都进弹层（封面本身是个 button，键盘也能到）
    if (card) openWorkModal(card.dataset.id);
  });
}

/* 弹层在 #detail 之外（fixed 定位放进带 transform 的 .detail-inner 里会踩包含块的坑），
   所以单独挂一份委托。任务一律从 state.modalId 取，不复用创作台的当前工单 */
function bindWorkModal() {
  const mask = $('#work-modal');
  if (!mask) return;

  mask.addEventListener('click', async (e) => {
    if (e.target === mask) { closeWorkModal(); return; }   // 点遮罩空白处关闭
    const closeBtn = e.target.closest('#btn-work-close');
    if (closeBtn) { closeWorkModal(); return; }
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) await handleDetailAction(getTask(state.modalId), actionBtn.dataset.action, actionBtn);
  });
}

/* ---------------- 新手引导（首启遮罩导览） ---------------- */

const TOUR_KEY = 'td-onboarded-v1';
const TOUR_STEPS = [
  {
    target: '#btn-conn', side: 'bottom',
    title: '连接词元跳动网关',
    text: '第一次使用先完成连接：点这里拉起浏览器授权页，确认后平台把授权码回传到本机临时端口（127.0.0.1）换出 API Key——只经过你的浏览器与本机，不经过任何第三方。',
  },
  {
    target: '#btn-new', side: 'bottom',
    title: '新建工单',
    text: '创作台一次只配一段：按下它开一张新工单，选好模型、填上提示词与参数，点「开始生成」提交。',
  },
  {
    target: '#panel-studio', side: 'center',
    title: '创作台',
    text: '需求在这里下达。选择模型与生成方式、填写提示词、调整参数，底部会实时预估费用，确认后点「开始生成」。',
  },
  {
    target: '[data-tab="wall"]', side: 'right',
    title: '作品墙',
    text: '提交后切到这里跟踪排队与生成进度，可按状态筛选。完成后视频自动下载到本机永久保留，点开卡片即可播放或导出。',
  },
];

let tourRoot = null;
let tourStep = 0;
let tourPending = false;

function tourSeen() {
  try { return !!localStorage.getItem(TOUR_KEY); } catch { return true; }
}

function markTourSeen() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* 忽略 */ }
}

function endTour() {
  if (tourRoot) tourRoot.remove();
  tourRoot = null;
  window.removeEventListener('resize', layoutTour);
  markTourSeen();
}

function layoutTour() {
  if (!tourRoot) return;
  const step = TOUR_STEPS[tourStep];
  const el = document.querySelector(step.target);
  const spot = $('.tour-spot', tourRoot);
  const card = $('.tour-card', tourRoot);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(330, vw - 32);
  card.style.width = `${cardW}px`;

  if (!el) {
    spot.style.cssText += ';opacity:0';
    card.style.left = `${(vw - cardW) / 2}px`;
    card.style.top = `${vh * 0.3}px`;
    return;
  }
  const r = el.getBoundingClientRect();
  const pad = 8;
  spot.style.opacity = '1';
  spot.style.left = `${r.left - pad}px`;
  spot.style.top = `${r.top - pad}px`;
  spot.style.width = `${r.width + pad * 2}px`;
  spot.style.height = `${r.height + pad * 2}px`;

  const cardH = card.offsetHeight || 170;
  let left;
  let top;
  if (step.side === 'right') {
    left = Math.min(r.right + 18, vw - cardW - 16);
    top = Math.min(Math.max(r.top + r.height / 2 - cardH / 2, 16), vh - cardH - 16);
  } else if (step.side === 'center') {
    left = Math.min(Math.max(r.left + r.width / 2 - cardW / 2, 16), vw - cardW - 16);
    top = Math.min(Math.max(r.top + r.height / 2 - cardH / 2, 16), vh - cardH - 16);
  } else {
    // bottom：优先目标下方，放不下则放上方
    left = Math.min(Math.max(r.left + r.width / 2 - cardW / 2, 16), vw - cardW - 16);
    top = r.bottom + 14 + cardH > vh ? Math.max(r.top - cardH - 14, 16) : r.bottom + 14;
  }
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function renderTourStep() {
  if (!tourRoot) return;
  const step = TOUR_STEPS[tourStep];
  const last = tourStep === TOUR_STEPS.length - 1;
  $('.tour-step', tourRoot).textContent = `${tourStep + 1} / ${TOUR_STEPS.length}`;
  $('.tour-title', tourRoot).textContent = step.title;
  $('.tour-text', tourRoot).textContent = step.text;
  $('.tour-prev', tourRoot).classList.toggle('hidden', tourStep === 0);
  $('.tour-next', tourRoot).textContent = last ? '开始使用' : '下一步';
  layoutTour();
}

function startTour() {
  if (tourRoot) return;
  tourStep = 0;
  tourRoot = document.createElement('div');
  tourRoot.className = 'tour-root';
  tourRoot.innerHTML = `
    <div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-card" role="dialog" aria-label="新手引导">
      <span class="tour-step"></span>
      <h3 class="tour-title"></h3>
      <p class="tour-text"></p>
      <div class="tour-actions">
        <button type="button" class="btn btn-ghost btn-sm tour-skip">跳过</button>
        <button type="button" class="btn btn-ghost btn-sm tour-prev">上一步</button>
        <button type="button" class="btn btn-primary btn-sm tour-next">下一步</button>
      </div>
    </div>`;
  document.body.appendChild(tourRoot);
  $('.tour-skip', tourRoot).addEventListener('click', endTour);
  $('.tour-prev', tourRoot).addEventListener('click', () => { tourStep = Math.max(0, tourStep - 1); renderTourStep(); });
  $('.tour-next', tourRoot).addEventListener('click', () => {
    if (tourStep >= TOUR_STEPS.length - 1) endTour();
    else { tourStep += 1; renderTourStep(); }
  });
  window.addEventListener('resize', layoutTour);
  renderTourStep();
}

/* ---------------- 启动 ---------------- */

async function boot() {
  applyTheme();
  mountWall();
  bindGlobal();
  bindWallEvents();
  bindWorkModal();
  bindSettings();
  bindDetailEvents();
  try {
    [state.tasks, state.settings, state.models, state.appInfo] = await Promise.all([
      studio.listTasks(),
      studio.getSettings(),
      studio.listModels(),
      studio.getAppInfo(),
    ]);
  } catch (err) {
    showToast(err.message, 'error');
  }
  // 关掉再打开要能找回上一张没提交的工单。failed 不自动载回 ——
  // 它在作品墙上看得见，要改由用户自己点「重新编辑」
  const draft = state.tasks.find((t) => t.status === 'draft');
  state.selectedId = draft ? draft.id : null;
  state.tab = 'studio';
  renderTabs();
  renderStudio(true);
  renderWall(true);

  // 模型目录在线同步：先用内置/缓存目录完成首屏渲染，网络同步异步补齐
  refreshModels();

  // 网关状态灯：不阻塞首屏，后台检测
  refreshConnStatus();

  // 首次启动（未配置 API Key）时引导完成网关设置
  if (state.settings && !state.settings.apiKey) {
    await openSettings();
    showToast('首次使用请先完成网关授权或填入 API Key');
  }

  // 新手引导：首次启动时演示主流程；若设置弹窗已自动打开，等它关闭后再开始
  if (!tourSeen()) {
    if ($('#settings-modal').classList.contains('hidden')) startTour();
    else tourPending = true;
  }

  studio.onTasksChanged((list) => {
    state.tasks = list;
    // 当前工单被别处删掉/提交掉了才去找新的草稿，绝不主动选中别的任务
    if (!currentOrder()) {
      const d = state.tasks.find((t) => t.status === 'draft');
      if ((d && d.id) !== state.selectedId) {
        state.selectedId = d ? d.id : null;
        state.detailSig = '';
      }
    }
    renderDetail();
    renderWorkModal();
  });
}

boot();
