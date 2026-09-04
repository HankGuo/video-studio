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
  x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

const state = {
  tasks: [],
  models: [],
  selectedId: null,
  settings: null,
  detailSig: '',
  saveStateTimer: null,
};

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

function toFileUrl(p) {
  return 'file://' + String(p).split('/').map(encodeURIComponent).join('/');
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

function renderSidebar() {
  const list = $('#task-list');
  const drafts = state.tasks.filter((t) => t.status === 'draft').length;

  $('#queue-count').textContent = String(state.tasks.length);
  $('#btn-submit-all').classList.toggle('hidden', drafts === 0);
  $('#draft-count').textContent = drafts ? `（${drafts}）` : '';

  if (!state.tasks.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = state.tasks.map((t) => {
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
      <article class="task-card ${t.id === state.selectedId ? 'selected' : ''}" data-id="${t.id}">
        <div class="card-top">
          <span class="card-model">${escapeHtml(model ? model.name : t.model)}</span>
          ${badge(t)}
        </div>
        <p class="card-prompt ${prompt ? '' : 'empty'}">${prompt ? escapeHtml(prompt) : '（未填写提示词）'}</p>
        <div class="card-meta">
          <span>${MODE_LABEL[t.mode] || t.mode} · ${escapeHtml(metaLine(t))}</span>
          <span>${fmtTime(t.createdAt)}</span>
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
          <rect x="4" y="4" width="40" height="40" rx="10" stroke="#27272A" stroke-width="1.5"/>
          <path d="M17 15.5v17l14.5-8.5z" stroke="#52525B" stroke-width="1.6" stroke-linejoin="round"/>
          <circle cx="17" cy="15.5" r="2.4" fill="#22C55E"/>
          <circle cx="17" cy="32.5" r="1.7" fill="#3F3F46"/>
          <circle cx="31.5" cy="24" r="1.7" fill="#3F3F46"/>
          <path d="M36 18v12" stroke="#22C55E" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M39.5 20.4v7.2" stroke="#3F3F46" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <h2>从第一段视频开始</h2>
      <p>新建片段，从词元跳动网关的 ${modelCount} 个视频模型中选择一个，配置提示词、素材与参数，提交后即可在这里跟踪生成进度与结果。</p>
      <button class="btn btn-primary" data-action="new">${ICONS.plus}新建片段</button>
      <div class="empty-hint">TOKENDANCE.SPACE · ${modelCount} VIDEO MODELS · ${famCount} FAMILIES</div>
    </div>`;
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
        ${t.error ? `<div class="meta-row"><span class="meta-key">错误信息</span><span class="meta-val" style="color:var(--danger)">${escapeHtml(t.error)}</span></div>` : ''}
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
    ? `<div class="player-frame"><video src="${toFileUrl(t.videoPath)}" controls playsinline preload="metadata"></video></div>`
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
        <div class="meta-row"><span class="meta-key">说明</span><span class="meta-val" style="color:var(--faint);font-size:11.5px">远程地址 24 小时后失效，视频已保存到本地，可随时回看</span></div>
      </div>
      <div class="detail-actions" style="margin-top:4px">
        ${t.videoPath ? `<button class="btn btn-ghost" data-action="reveal">${ICONS.folder}在 Finder 中显示</button>` : ''}
        ${t.videoPath ? `<button class="btn btn-ghost" data-action="open">${ICONS.external}用默认播放器打开</button>` : ''}
        <button class="btn btn-ghost" data-action="duplicate">${ICONS.copy}复制为新片段</button>
        <button class="btn btn-ghost btn-danger" data-action="remove">${ICONS.trash}删除片段</button>
      </div>
    </div>`;
}

/* ---------------- 编辑器 ---------------- */

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
    <div class="model-family">
      <div class="model-family-name">${escapeHtml(fam.name)} · ${fam.items.length}</div>
      <div class="model-grid">
        ${fam.items.map((m) => `
          <button type="button" class="model-card ${t.model === m.id ? 'active' : ''}" data-model="${m.id}">
            <span class="model-card-head">
              <span class="model-card-name">${escapeHtml(m.name)}</span>
              ${m.badge ? `<span class="model-badge">${escapeHtml(m.badge)}</span>` : ''}
            </span>
            <span class="model-card-id">${escapeHtml(m.id)}</span>
            <span class="model-card-pricing">${escapeHtml(m.pricing || '')}</span>
            <span class="model-card-desc">${escapeHtml(m.desc || '')}</span>
          </button>`).join('')}
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
    const thumb = kind === 'image' ? `<img class="media-thumb" src="${toFileUrl(m.path)}" alt="" />` : '';
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
      ? `<img src="${toFileUrl(m.path)}" alt="" />`
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
        ${mediaSlotHtml(t, 'firstFrame', '首帧图片', 'image', true)}
        ${mediaSlotHtml(t, 'lastFrame', '尾帧图片（可选）', 'image', false)}
        <span class="hint">支持选择本地图片，或直接粘贴可公开访问的图片 URL；宽高比可在下方固定或设为自适应</span>
      </section>`;
  }
  if (t.mode === 'reference') {
    const extra = model.refImagesOnly ? '' : `
      ${mediaSlotHtml(t, 'refVideo', '参考视频（仅 URL）', 'video', false, true)}
      ${mediaSlotHtml(t, 'refAudio', '参考音频（仅 URL）', 'audio', false, true)}`;
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

  const promptLabel = t.mode === 'edit' ? '编辑指令' : '提示词';
  const promptPlaceholder = t.mode === 'edit'
    ? '描述希望对源视频做的修改，例如：把画面转为水彩风格，保留人物动作'
    : '描述想要的画面、动作与镜头语言，例如：女人坐在咖啡馆里抬头看向窗外，镜头推进拍到街道，暖色调';

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
      <section class="editor-section">
        <span class="section-label">模型<span class="section-note">${state.models.length} MODELS · TOKENDANCE GATEWAY</span></span>
        ${modelPickerHtml(t)}
      </section>
      ${modeSegmentedHtml(t, model)}
      <section class="editor-section">
        <span class="section-label">${promptLabel}</span>
        <textarea class="prompt-input" id="f-prompt" placeholder="${promptPlaceholder}">${escapeHtml(t.prompt)}</textarea>
      </section>
      ${mediaSectionHtml(t, model)}
      ${paramsHtml(t, model)}
      <div class="editor-foot">
        <span class="save-state" id="save-state">更改会自动保存</span>
        <div class="foot-actions">
          <button class="btn btn-ghost btn-danger" data-action="remove">${ICONS.trash}删除</button>
          <button class="btn btn-primary" data-action="submit">${ICONS.play}开始生成</button>
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
          await studio.redownloadTask(t.id);
          showToast('已开始重新下载', 'success');
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
      const file = await studio.pickMedia(pickBtn.dataset.kind);
      if (file) await patchMedia(t, key, { source: 'local', path: file.path, name: file.name });
      return;
    }

    const clearBtn = e.target.closest('[data-media-clear]');
    if (clearBtn && t && editable(t)) {
      await patchMedia(t, clearBtn.dataset.mediaClear, null);
      return;
    }

    const refAddBtn = e.target.closest('[data-ref-add="local"]');
    if (refAddBtn && t && editable(t)) {
      const file = await studio.pickMedia('image');
      if (file) {
        await patchRefImages(t, (refs) => [...refs, { source: 'local', path: file.path, name: file.name }]);
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
    if (e.target.id === 'f-prompt') scheduleSave(t, { prompt: e.target.value });
    else if (e.target.id === 'f-duration') {
      if (e.target.value === '') {
        const m = getModel(t.model);
        if (m && m.durationAuto) scheduleSave(t, { duration: -1 });
      } else {
        scheduleSave(t, { duration: e.target.value });
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
  $('#settings-modal').classList.add('hidden');
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
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/* ---------------- 全局事件 ---------------- */

function bindGlobal() {
  $('#btn-new').addEventListener('click', newTask);
  $('#btn-submit-all').addEventListener('click', submitAll);

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
    if (e.key === 'Escape') closeSettings();
  });

  setInterval(() => {
    const el = $('#elapsed');
    if (el && el.dataset.since) el.textContent = fmtElapsed(Number(el.dataset.since));
  }, 1000);
}

/* ---------------- 启动 ---------------- */

async function boot() {
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

  // 首次启动（未配置 API Key）时引导完成网关设置
  if (state.settings && !state.settings.apiKey) {
    await openSettings();
    showToast('首次使用请先在设置中填入 API Key', 'error');
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
