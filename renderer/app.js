'use strict';

/* global studio */

const $ = (sel, el = document) => el.querySelector(sel);

const MODE_LABEL = { text: '文生视频', image: '图生视频', reference: '参考生视频', edit: '视频编辑' };
const STATUS_LABEL = {
  draft: '草稿', submitting: '提交中', queued: '排队中', running: '生成中',
  succeeded: '已完成', failed: '失败', cancelled: '已取消', expired: '已过期',
};
const DEFAULT_MODEL = 'minimax-h3';
const LAST_MODEL_KEY = 'td-last-model';
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
  selectedId: null,
  settings: null,
  detailSig: '',
  saveStateTimer: null,
  filter: 'all',
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

function getModel(id) {
  return state.models.find((m) => m.id === id) || state.models.find((m) => m.id === DEFAULT_MODEL) || null;
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
  renderSidebar();
}

function ratioLabel(r) {
  return r === 'adaptive' ? '自适应' : r;
}

function durationLabel(d) {
  return Number(d) === -1 ? '智能' : `${d}s`;
}

/* ---------------- 模型目录同步 ---------------- */

function syncStatusText() {
  const n = state.models.length;
  const s = state.modelSync;
  if (s.source === 'remote' && s.syncedAt) return `${n} MODELS · 已同步 ${fmtClock(s.syncedAt)}`;
  if (s.source === 'cache') return `${n} MODELS · 本地缓存`;
  return `${n} MODELS · 内置目录`;
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

/* ---------------- 侧栏 ---------------- */

const QUEUE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'active', label: '进行中' },
  { key: 'succeeded', label: '完成' },
  { key: 'failed', label: '失败' },
];
const ACTIVE_STATUSES = ['submitting', 'queued', 'running'];

function taskInGroup(t, key) {
  switch (key) {
    case 'draft': return t.status === 'draft';
    case 'active': return ACTIVE_STATUSES.includes(t.status);
    case 'succeeded': return t.status === 'succeeded';
    case 'failed': return t.status === 'failed';
    default: return true;
  }
}

function renderQueueFilters() {
  const box = $('#queue-filters');
  if (!box) return;
  box.innerHTML = QUEUE_FILTERS.map((f) => {
    const n = state.tasks.filter((t) => taskInGroup(t, f.key)).length;
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

/* 侧栏卡片的参数用彩色小签呈现，替代一长串点分文字 */
function metaChipsHtml(t) {
  const parts = [MODE_LABEL[t.mode] || t.mode, durationLabel(t.duration), t.resolution];
  if (t.ratio) parts.push(ratioLabel(t.ratio));
  if (t.audio) parts.push('有声');
  return parts.map((p) => `<span class="meta-chip">${escapeHtml(p)}</span>`).join('');
}

function renderSidebar() {
  const list = $('#task-list');
  const drafts = state.tasks.filter((t) => t.status === 'draft').length;

  $('#queue-count').textContent = String(state.tasks.length);
  $('#btn-submit-all').classList.toggle('hidden', drafts === 0);
  $('#draft-count').textContent = drafts ? `（${drafts}）` : '';
  renderQueueFilters();

  if (!state.tasks.length) {
    list.innerHTML = '';
    return;
  }

  const visible = state.tasks.filter((t) => taskInGroup(t, state.filter));
  if (!visible.length) {
    const label = (QUEUE_FILTERS.find((f) => f.key === state.filter) || {}).label || '';
    list.innerHTML = `<div class="queue-empty">没有「${label}」状态的片段</div>`;
    return;
  }

  list.innerHTML = visible.map((t) => {
    const prompt = (t.prompt || '').trim();
    const model = getModel(t.model);
    const actions = [];
    if (t.status === 'draft' || t.status === 'failed') {
      actions.push(`<button class="icon-btn" data-action="submit" title="开始生成">${ICONS.play}</button>`);
    }
    actions.push(`<button class="icon-btn" data-action="duplicate" title="复制为新片段">${ICONS.copy}</button>`);
    actions.push(`<button class="icon-btn" data-action="remove" title="删除">${ICONS.trash}</button>`);
    const runningBar = (t.status === 'running' || t.status === 'queued' || t.status === 'submitting')
      ? '<div class="running-bar"><i></i></div>' : '';
    return `
      <article class="task-card ${t.id === state.selectedId ? 'selected' : ''}" data-id="${t.id}" data-family="${model ? escapeHtml(model.family) : ''}">
        <div class="card-top">
          <span class="card-model">${famIcon(model ? model.family : '')}${escapeHtml(model ? model.name : t.model)}</span>
          ${badge(t)}
        </div>
        <p class="card-prompt ${prompt ? '' : 'empty'}">${prompt ? escapeHtml(prompt) : '（未填写提示词）'}</p>
        <div class="card-meta">
          <span class="card-chips">${metaChipsHtml(t)}</span>
          <span class="card-time">${fmtTime(t.createdAt)}</span>
        </div>
        ${runningBar}
        <div class="card-actions">${actions.join('')}</div>
      </article>`;
  }).join('');
}

/* ---------------- 详情 ---------------- */

function renderDetail(force = false) {
  const t = getTask(state.selectedId);
  const sig = t
    ? [t.id, t.status, t.mode, t.model, t.error, t.downloadError, t.videoPath, t.videoUrl, t.audio].join('|')
    : 'empty';
  if (!force && sig === state.detailSig) return;
  state.detailSig = sig;

  const box = $('#detail');
  if (!t) {
    box.innerHTML = emptyHtml();
    return;
  }

  if (editable(t)) {
    box.innerHTML = editorHtml(t);
  } else if (t.status === 'submitting' || t.status === 'queued' || t.status === 'running') {
    box.innerHTML = progressHtml(t);
  } else if (t.status === 'succeeded') {
    box.innerHTML = playerHtml(t);
  } else {
    box.innerHTML = readonlyHtml(t);
  }
}

function emptyHtml() {
  const modelCount = state.models.length || 17;
  const famCount = new Set(state.models.map((m) => m.family)).size || 5;
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
      <h2>从第一段视频开始</h2>
      <p>新建片段，从词元跳动网关的 ${modelCount} 个视频模型中选择一个，配置提示词、素材与参数，提交后即可在这里跟踪生成进度与结果。</p>
      <button class="btn btn-primary" data-action="new">${ICONS.plus}新建片段</button>
      ${vendorRowHtml()}
      <div class="empty-hint">TOKENDANCE.SPACE · ${modelCount} VIDEO MODELS · ${famCount} FAMILIES</div>
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
  return `<div class="empty-vendors">${chips}</div>`;
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
          <button class="btn btn-primary" data-action="duplicate">${ICONS.copy}复制为新片段</button>
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

/* 价签：多档取价格区间，单档取单价，token 计费直接说明——一行解决，不再堆单元格 */
function priceSummaryHtml(m) {
  const { unit, cells } = parsePricing(m.pricing, m.resolutions);
  if (!cells.length) return m.pricing ? `<span class="price-line price-token">按量计费</span>` : '';
  if (unit !== '/秒') return `<span class="price-line">¥${cells[0].price}<small>/百万 tokens</small></span>`;
  const prices = cells.map((c) => c.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return `<span class="price-line">${lo === hi ? `¥${lo}` : `¥${lo}–${hi}`}<small>/秒</small></span>`;
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
  const model = t && getModel(t.model);
  const text = t && model ? costEstimate(t, model, patch) : '';
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

/* 生成方式缩写 */
const MODE_CHAR = { text: '文', image: '图', reference: '参', edit: '编' };

function modelPickerHtml(t) {
  const families = [];
  for (const m of state.models) {
    let fam = families.find((f) => f.key === m.family);
    if (!fam) {
      fam = { key: m.family, name: m.familyName || m.family, items: [] };
      families.push(fam);
    }
    fam.items.push(m);
  }
  return families.map((fam) => `
    <div class="model-family" data-family="${escapeHtml(fam.key)}">
      <div class="model-family-name">${famIcon(fam.key)}${escapeHtml(fam.name)} · ${fam.items.length}</div>
      <div class="model-grid">
        ${fam.items.map((m) => {
          const active = t.model === m.id;
          return `
          <button type="button" class="model-card ${active ? 'active' : ''}" data-model="${m.id}">
            <span class="model-card-head">
              <span class="model-card-name">${escapeHtml(m.name)}</span>
              ${m.badge ? `<span class="model-badge">${escapeHtml(m.badge)}</span>` : ''}
            </span>
            ${priceSummaryHtml(m)}
            ${tagRowHtml(m)}
            ${active ? `
            <span class="model-card-more">
              ${m.pricing ? `<span class="more-pricing">${escapeHtml(m.pricing)}</span>` : ''}
              ${m.desc ? `<span class="more-desc">${escapeHtml(m.desc)}</span>` : ''}
              <span class="more-id">${escapeHtml(m.id)}</span>
            </span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');
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

function paramsHtml(t, model) {
  const [min, max] = model.duration;
  const durationVal = Number(t.duration) === -1 ? '' : t.duration;
  const audioBlock = model.audio ? `
    <div class="field-col" style="flex:0 0 auto;min-width:120px">
      <span class="section-label">有声视频</span>
      <div class="toggle-row">
        <button type="button" class="toggle" role="switch" aria-checked="${t.audio ? 'true' : 'false'}" data-field="audio" aria-label="有声视频开关"></button>
        <span class="toggle-label">${t.audio ? '开启' : '关闭'}</span>
      </div>
    </div>` : '';
  const adaptiveHint = (t.mode === 'image' || t.mode === 'edit') && t.ratio === 'adaptive'
    ? '<span class="hint accent">比例自适应：输出宽高比将跟随输入素材</span>' : '';
  const autoHint = model.durationAuto && Number(t.duration) === -1
    ? '<span class="hint">智能时长：由模型根据内容自动决定</span>' : '';
  return `
    <section class="editor-section">
      <div class="field-row">
        <div class="field-col">
          <span class="section-label">时长（秒）<span class="section-note">${min}–${max}s</span></span>
          <div class="chips" data-field="duration">
            ${durationChipsHtml(t, model)}
            <input type="number" id="f-duration" min="${min}" max="${max}" value="${durationVal}" placeholder="${model.durationAuto ? '智能' : ''}" style="width:76px" />
          </div>
          ${autoHint}
        </div>
        <div class="field-col">
          <span class="section-label">分辨率</span>
          <div class="chips" data-field="resolution">
            ${model.resolutions.map((r) => `<button type="button" class="chip ${t.resolution === r ? 'active' : ''}" data-value="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('')}
          </div>
        </div>
        <div class="field-col">
          <span class="section-label">画面比例</span>
          <div class="chips" data-field="ratio">
            ${model.ratios.map((r) => `<button type="button" class="chip ${t.ratio === r ? 'active' : ''}" data-value="${escapeHtml(r)}">${ratioLabel(r)}</button>`).join('')}
          </div>
          ${adaptiveHint}
        </div>
        ${audioBlock}
      </div>
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
  if (t.mode === 'reference') {
    const extra = model.refImagesOnly ? '' : `
      <div class="media-grid">
        ${mediaSlotHtml(t, 'refVideo', '参考视频（仅 URL）', 'video', false, true)}
        ${mediaSlotHtml(t, 'refAudio', '参考音频（仅 URL）', 'audio', false, true)}
      </div>`;
    return `
      <section class="editor-section">
        <span class="section-label">参考素材</span>
        ${refImagesHtml(t, model)}
        ${extra}
        <span class="hint">${model.refImagesOnly ? '至少添加一张参考图片' : '参考图片与参考视频至少提供一项，可自由组合'}</span>
      </section>`;
  }
  if (t.mode === 'edit') {
    return `
      <section class="editor-section">
        <span class="section-label">编辑素材</span>
        ${mediaSlotHtml(t, 'editVideo', '源视频（仅 URL）', 'video', true, true)}
        ${refImagesHtml(t, model)}
        <span class="hint">源视频为待编辑的原始片段；参考图可选，用于风格 / 主体替换</span>
      </section>`;
  }
  return '';
}

function editorHtml(t) {
  const model = getModel(t.model);
  if (!model) return '<div class="detail-inner">模型目录加载失败</div>';

  const failedBanner = t.status === 'failed' && t.error
    ? `<div class="form-error">${ICONS.alert}<div><strong>上次提交失败</strong><br>${escapeHtml(t.error)}</div></div>` : '';

  // 任务保存的模型已不在目录中（下线或目录未同步）：提示重新选择，而不是静默兜底
  const staleBanner = model.id !== t.model
    ? `<div class="form-error form-warn">${ICONS.alert}<div><strong>模型已下线</strong><br>该片段使用的模型 ${escapeHtml(t.model)} 已不在当前目录中，请重新选择模型后再提交。</div></div>` : '';

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
      ${staleBanner}
      <section class="editor-section">
        <span class="section-label">模型<span class="section-note sync-note"><span id="sync-status">${syncStatusText()}</span><button type="button" class="icon-btn sync-refresh ${state.modelSyncing ? 'spinning' : ''}" data-action="sync-models" title="同步模型目录" ${state.modelSyncing ? 'disabled' : ''}>${ICONS.refresh}</button></span></span>
        ${modelPickerHtml(t)}
      </section>
      ${modeSegmentedHtml(t, model)}
      <section class="editor-section">
        <span class="section-label">${promptLabel}<span class="section-note" id="prompt-count">${promptLen ? `${promptLen} 字` : ''}</span></span>
        <textarea class="prompt-input" id="f-prompt" placeholder="${promptPlaceholder}">${escapeHtml(t.prompt)}</textarea>
      </section>
      ${mediaSectionHtml(t, model)}
      ${paramsHtml(t, model)}
      <div class="editor-foot">
        <div class="foot-left">
          <span class="cost-estimate ${cost ? '' : 'hidden'}" id="cost-estimate">${escapeHtml(cost)}</span>
          <span class="save-state" id="save-state">更改会自动保存</span>
        </div>
        <div class="foot-actions">
          <button class="btn btn-ghost btn-danger" data-action="remove">${ICONS.trash}删除</button>
          <button class="btn btn-primary" data-action="submit" title="开始生成（${MOD_HINT}⏎）">${ICONS.play}开始生成</button>
        </div>
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

function rememberModel(id) {
  try { localStorage.setItem(LAST_MODEL_KEY, id); } catch { /* 忽略 */ }
}

function lastModel() {
  try {
    const id = localStorage.getItem(LAST_MODEL_KEY);
    if (id && getModel(id)) return id;
  } catch { /* 忽略 */ }
  return DEFAULT_MODEL;
}

async function newTask() {
  try {
    const task = await studio.createTask({ model: lastModel() });
    mergeTask(task);
    state.selectedId = task.id;
    renderSidebar();
    renderDetail(true);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function duplicateTask(id) {
  try {
    const task = await studio.duplicateTask(id);
    mergeTask(task);
    state.selectedId = task.id;
    renderSidebar();
    renderDetail(true);
    showToast('已复制为新片段', 'success');
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
    if (state.selectedId === id) state.selectedId = null;
    if (!getTask(state.selectedId)) {
      state.selectedId = state.tasks.length ? state.tasks[0].id : null;
    }
    renderSidebar();
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
    state.selectedId = id;
    renderSidebar();
    renderDetail(true);
    showToast(problem, 'error');
    return;
  }
  try {
    const submitted = await studio.submitTask(id);
    mergeTask(submitted);
    if (submitted.status === 'failed') showToast(submitted.error || '提交失败', 'error');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitAll() {
  await flushSave(getTask(state.selectedId));
  const drafts = state.tasks.filter((t) => t.status === 'draft');
  for (const t of drafts) {
    const problem = validateForSubmit(t);
    if (problem) {
      state.selectedId = t.id;
      renderSidebar();
      renderDetail(true);
      showToast(`有片段未配置完整：${problem}`, 'error');
      return;
    }
  }
  try {
    await studio.submitAllTasks();
    showToast('全部草稿已提交', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
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
        else showToast('已提交，开始生成', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
      break;
    }
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
          renderDetail(true);
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
    const t = getTask(state.selectedId);

    const modelBtn = e.target.closest('[data-model]');
    if (modelBtn && t && editable(t) && modelBtn.dataset.model !== t.model) {
      try {
        await flushSave(t);
        const updated = await studio.updateTask(t.id, { model: modelBtn.dataset.model });
        mergeTask(updated);
        rememberModel(updated.model);
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
  $('#settings-modal').classList.remove('hidden');
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
  $('#btn-submit-all').addEventListener('click', submitAll);
  $('#btn-theme').addEventListener('click', cycleTheme);
  $('#btn-conn').addEventListener('click', openSettings);
  $('#btn-help').addEventListener('click', startTour);

  // 快捷键提示写进按钮 tooltip
  $('#btn-new').title = `新建片段（${MOD_HINT}N）`;
  $('#btn-settings').title = `设置（${MOD_HINT},）`;

  $('#queue-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip || chip.dataset.filter === state.filter) return;
    state.filter = chip.dataset.filter;
    renderSidebar();
  });

  $('#task-list').addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    const card = e.target.closest('.task-card');
    if (actionBtn && card) {
      e.stopPropagation();
      const id = card.dataset.id;
      const action = actionBtn.dataset.action;
      if (action === 'submit') await submitOne(id);
      else if (action === 'duplicate') await duplicateTask(id);
      else if (action === 'remove') await removeTask(id);
      return;
    }
    if (card) {
      state.selectedId = card.dataset.id;
      renderSidebar();
      renderDetail(true);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tourRoot) { endTour(); return; }
      closeSettings();
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'n') {
      e.preventDefault();
      newTask();
    } else if (key === 'enter') {
      const t = getTask(state.selectedId);
      if (t && (t.status === 'draft' || t.status === 'failed')) {
        e.preventDefault();
        submitOne(t.id);
      }
    } else if (key === ',') {
      e.preventDefault();
      openSettings();
    }
  });

  setInterval(() => {
    const el = $('#elapsed');
    if (el && el.dataset.since) el.textContent = fmtElapsed(Number(el.dataset.since));
  }, 1000);
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
    title: '新建片段',
    text: '每段视频是一个独立片段。可以一次排布多段，各自的模型、时长、画质、画面比例完全独立，互不干扰。',
  },
  {
    target: '#detail', side: 'center',
    title: '配置与提交',
    text: '在编辑器里选择模型与生成方式、填写提示词、调整参数；底部会实时预估费用，确认后点「开始生成」。',
  },
  {
    target: '.sidebar', side: 'right',
    title: '任务队列',
    text: '提交后在这里跟踪排队与生成进度，可按状态筛选。完成后视频自动下载到本机永久保留，点开卡片即可播放或导出。',
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
  bindGlobal();
  bindSettings();
  bindDetailEvents();
  try {
    [state.tasks, state.settings, state.models] = await Promise.all([
      studio.listTasks(),
      studio.getSettings(),
      studio.listModels(),
    ]);
  } catch (err) {
    showToast(err.message, 'error');
  }
  if (!getTask(state.selectedId) && state.tasks.length) {
    state.selectedId = state.tasks[0].id;
  }
  renderSidebar();
  renderDetail(true);

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
    if (!getTask(state.selectedId)) {
      state.selectedId = state.tasks.length ? state.tasks[0].id : null;
      state.detailSig = '';
    }
    renderSidebar();
    renderDetail();
  });
}

boot();
