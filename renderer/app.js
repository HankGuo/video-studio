'use strict';

/* global studio */

const $ = (sel, el = document) => el.querySelector(sel);

const MODE_LABEL = { text: '文生视频', image: '图生视频', reference: '参考生视频' };
const MODE_DESC = {
  text: '纯文字描述生成画面',
  image: '以图片作为首帧 / 首尾帧',
  reference: '参考图 / 视频 / 音频生成',
};
const STATUS_LABEL = {
  draft: '待提交', submitting: '提交中', queued: '排队中', running: '生成中',
  succeeded: '已完成', failed: '失败', cancelled: '已取消', expired: '已过期',
};
const STATUS_TONE = {
  draft: 'yellow', submitting: 'blue', queued: 'yellow', running: 'blue',
  succeeded: 'green', failed: 'red', cancelled: 'gray', expired: 'gray',
};
const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const RESOLUTIONS = ['768P', '2K'];
const DURATIONS = [6, 8, 10];

const ICONS = {
  plus: '<svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 16 16"><path d="M5 3.8v8.4L12.4 8z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5V10A1.5 1.5 0 0 0 4 11.5h1.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  trash: '<svg viewBox="0 0 16 16"><path d="M2.5 4.5h11M6.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4 4.5l.7 8.2a1.5 1.5 0 0 0 1.5 1.3h3.6a1.5 1.5 0 0 0 1.5-1.3L12 4.5M6.8 7.5v4M9.2 7.5v4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  folder: '<svg viewBox="0 0 16 16"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6a1.5 1.5 0 0 1 1.1.5l1 1.2a1.5 1.5 0 0 0 1.1.5h3.2A1.5 1.5 0 0 1 14 6.7v5.8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  image: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5.4" cy="6.2" r="1.1" fill="currentColor"/><path d="M2.5 11.5 6 8.4l2.4 2.1 2.2-2 2.9 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 16 16"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  alert: '<svg viewBox="0 0 16 16"><path d="M8 1.8 15 13.5H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.2v3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.4" r="0.9" fill="currentColor"/></svg>',
  film: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 3v10M10.5 3v10M2 6.3h3.5M2 9.7h3.5M10.5 6.3H14M10.5 9.7H14" stroke="currentColor" stroke-width="1.1"/></svg>',
  external: '<svg viewBox="0 0 16 16"><path d="M6.5 3.5h-3v9h9v-3M9 3.5h3.5V7M13.2 3.8 7.5 9.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const state = {
  tasks: [],
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
  const tone = STATUS_TONE[t.status] || 'gray';
  const pulse = t.status === 'running' || t.status === 'submitting' ? ' pulse' : '';
  return `<span class="badge badge-${tone}${pulse}">${STATUS_LABEL[t.status] || t.status}</span>`;
}

function metaLine(t) {
  const parts = [MODE_LABEL[t.mode] || t.mode, `${t.duration}s`, t.resolution];
  if (t.mode === 'text') parts.push(t.ratio);
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

  list.innerHTML = state.tasks.map((t, i) => {
    const prompt = (t.prompt || '').trim();
    const actions = [];
    if (t.status === 'draft' || t.status === 'failed') {
      actions.push(`<button class="icon-btn" data-action="submit" title="开始生成">${ICONS.play}</button>`);
    }
    actions.push(`<button class="icon-btn" data-action="duplicate" title="复制为新片段">${ICONS.copy}</button>`);
    actions.push(`<button class="icon-btn" data-action="remove" title="删除">${ICONS.trash}</button>`);
    const runningBar = (t.status === 'running' || t.status === 'queued' || t.status === 'submitting')
      ? '<div class="running-bar"><i></i></div>' : '';
    return `
      <article class="task-card ${t.id === state.selectedId ? 'selected' : ''}" data-id="${t.id}" style="animation-delay:${Math.min(i, 6) * 40}ms">
        <div class="card-top">${badge(t)}<span class="card-time">${fmtTime(t.createdAt)}</span></div>
        <p class="card-prompt ${prompt ? '' : 'empty'}">${prompt ? escapeHtml(prompt) : '（未填写提示词）'}</p>
        <div class="card-meta">${escapeHtml(metaLine(t))}</div>
        ${runningBar}
        <div class="card-actions">${actions.join('')}</div>
      </article>`;
  }).join('');
}

/* ---------------- 详情 ---------------- */

function renderDetail(force = false) {
  const t = getTask(state.selectedId);
  const sig = t
    ? [t.id, t.status, t.mode, t.error, t.downloadError, t.videoPath, t.videoUrl].join('|')
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
  return `
    <div class="empty-state">
      <div class="empty-mark">${ICONS.film}</div>
      <h2>从第一段视频开始</h2>
      <p>新建片段，配置提示词、时长与画质，提交后即可在这里看到生成结果。每一段片段的配置相互独立，可以一次性排布多段。</p>
      <button class="btn btn-primary" data-action="new">${ICONS.plus}新建片段</button>
    </div>`;
}

function readonlyHtml(t) {
  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">${STATUS_LABEL[t.status] || t.status}</h2>
          <div class="detail-sub">${escapeHtml(metaLine(t))} · 创建于 ${fmtTime(t.createdAt)}</div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" data-action="duplicate">${ICONS.copy}复制为新片段</button>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-key">提示词</span><span class="meta-val">${escapeHtml(t.prompt || '（无）')}</span></div>
        <div class="meta-row"><span class="meta-key">远程任务</span><span class="meta-val mono">${escapeHtml(t.remoteId || '—')}</span></div>
      </div>
    </div>`;
}

function progressHtml(t) {
  const title = t.status === 'submitting' ? '正在提交任务' : t.status === 'queued' ? '排队等待中' : '正在生成视频';
  const sub = t.status === 'queued'
    ? '任务已进入远端队列，通常 1 – 3 分钟内完成'
    : '模型正在渲染画面，通常 1 – 3 分钟内完成';
  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">片段生成中</h2>
          <div class="detail-sub">${escapeHtml(metaLine(t))}</div>
        </div>
        ${badge(t)}
      </div>
      <div class="progress-panel">
        <div class="progress-ring"><i></i></div>
        <h3>${title}</h3>
        <p class="progress-sub">${sub}</p>
        <div class="progress-elapsed" id="elapsed" data-since="${t.submittedAt || t.updatedAt}">${fmtElapsed(t.submittedAt || t.updatedAt)}</div>
        <div class="progress-track"><i></i></div>
      </div>
      <div class="meta-grid" style="margin-top:16px">
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
          <div class="detail-sub">${escapeHtml(metaLine(t))} · ${fmtTime(t.updatedAt)} 完成</div>
        </div>
        ${badge(t)}
      </div>
      ${frame}
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-key">提示词</span><span class="meta-val">${escapeHtml(t.prompt || '（无）')}</span></div>
        <div class="meta-row"><span class="meta-key">远程任务</span><span class="meta-val mono">${escapeHtml(t.remoteId)}</span></div>
        <div class="meta-row"><span class="meta-key">本地文件</span><span class="meta-val mono">${t.videoPath ? escapeHtml(t.videoPath) : '—'}</span></div>
        ${urlRow}
        <div class="meta-row"><span class="meta-key">说明</span><span class="meta-val" style="color:var(--muted);font-size:12px">远程地址 24 小时后失效，视频已保存到本地，可随时回看</span></div>
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

function editorHtml(t) {
  const failedBanner = t.status === 'failed' && t.error
    ? `<div class="form-error">${ICONS.alert}<div><strong>上次提交失败</strong><br>${escapeHtml(t.error)}</div></div>` : '';

  const modeCards = Object.keys(MODE_LABEL).map((m) => `
    <button type="button" class="mode-card ${t.mode === m ? 'active' : ''}" data-mode="${m}">
      <span class="mode-name">${MODE_LABEL[m]}</span>
      <span class="mode-desc">${MODE_DESC[m]}</span>
    </button>`).join('');

  const ratioBlock = t.mode === 'text' ? `
    <div class="field-col">
      <span class="section-label">画面比例</span>
      <div class="chips" data-field="ratio">
        ${RATIOS.map((r) => `<button type="button" class="chip ${t.ratio === r ? 'active' : ''}" data-value="${r}">${r}</button>`).join('')}
      </div>
    </div>` : '';

  const mediaBlock = t.mode === 'image' ? `
    <section class="editor-section">
      <span class="section-label">帧图片</span>
      ${mediaSlotHtml(t, 'firstFrame', '首帧图片', 'image', true)}
      ${mediaSlotHtml(t, 'lastFrame', '尾帧图片（可选）', 'image', false)}
      <span class="hint">支持选择本地图片，或直接粘贴可公开访问的图片 URL；宽高比由图片决定</span>
    </section>` : t.mode === 'reference' ? `
    <section class="editor-section">
      <span class="section-label">参考素材</span>
      ${mediaSlotHtml(t, 'refImage', '参考图片', 'image', false)}
      ${mediaSlotHtml(t, 'refVideo', '参考视频（仅 URL）', 'video', false, true)}
      ${mediaSlotHtml(t, 'refAudio', '参考音频（仅 URL）', 'audio', false, true)}
      <span class="hint">参考图片与参考视频至少提供一项，可自由组合</span>
    </section>` : '';

  const durationChips = DURATIONS.map((d) =>
    `<button type="button" class="chip ${Number(t.duration) === d ? 'active' : ''}" data-value="${d}">${d}s</button>`).join('');

  return `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2 class="detail-title">${t.status === 'failed' ? '修改后重新提交' : '新建片段'}</h2>
          <div class="detail-sub">每段片段独立配置 · 创建于 ${fmtTime(t.createdAt)}</div>
        </div>
        ${badge(t)}
      </div>
      ${failedBanner}
      <section class="editor-section">
        <span class="section-label">生成方式</span>
        <div class="mode-cards">${modeCards}</div>
      </section>
      <section class="editor-section">
        <span class="section-label">提示词</span>
        <textarea class="prompt-input" id="f-prompt" placeholder="描述想要的画面、动作与镜头语言，例如：女人坐在咖啡馆里抬头看向窗外，镜头推进拍到街道，暖色调">${escapeHtml(t.prompt)}</textarea>
      </section>
      ${mediaBlock}
      <section class="editor-section">
        <div class="field-row">
          <div class="field-col">
            <span class="section-label">时长（秒）</span>
            <div class="chips" data-field="duration">
              ${durationChips}
              <input type="number" id="f-duration" min="1" max="15" value="${t.duration}" style="width:76px" />
            </div>
          </div>
          <div class="field-col">
            <span class="section-label">画质</span>
            <div class="chips" data-field="resolution">
              ${RESOLUTIONS.map((r) => `<button type="button" class="chip ${t.resolution === r ? 'active' : ''}" data-value="${r}">${r}</button>`).join('')}
            </div>
          </div>
          ${ratioBlock}
        </div>
      </section>
      <div class="editor-foot">
        <span class="save-state" id="save-state">更改会自动保存</span>
        <div class="foot-actions">
          <button class="btn btn-ghost btn-danger" data-action="remove">${ICONS.trash}删除</button>
          <button class="btn btn-primary" data-action="submit">${ICONS.play}开始生成</button>
        </div>
      </div>
    </div>`;
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
    body = `
      <div class="media-empty">
        ${urlOnly ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-media-pick="${key}" data-kind="${kind}">${ICONS.image}选择本地文件</button><span class="media-or">或</span>`}
        <input type="url" class="url-input" data-media-url="${key}" placeholder="粘贴${kind === 'image' ? '图片' : kind === 'video' ? '视频' : '音频'} URL，回车确认" spellcheck="false" />
      </div>`;
  }
  return `
    <div class="media-slot">
      <div class="media-slot-head"><span class="media-slot-title">${label}${req}</span></div>
      ${body}
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

function validateForSubmit(t) {
  if (t.mode === 'text' && !(t.prompt || '').trim()) return '文生视频需要填写提示词';
  if (t.mode === 'image' && !(t.media && t.media.firstFrame)) return '图生视频需要至少一张首帧图片';
  if (t.mode === 'reference') {
    const m = t.media || {};
    if (!m.refImage && !m.refVideo) return '参考生视频至少需要参考图片或参考视频';
  }
  return '';
}

/* ---------------- 任务操作 ---------------- */

async function newTask() {
  try {
    const task = await studio.createTask({ mode: 'text' });
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
      if (field === 'duration' && num) num.value = chip.dataset.value;
      scheduleSave(t, { [field]: value });
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

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) await handleDetailAction(t, actionBtn.dataset.action, actionBtn);
  });

  box.addEventListener('input', (e) => {
    const t = getTask(state.selectedId);
    if (!t || !editable(t)) return;
    if (e.target.id === 'f-prompt') scheduleSave(t, { prompt: e.target.value });
    else if (e.target.id === 'f-duration') scheduleSave(t, { duration: e.target.value });
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
    if (e.target.id === 'f-duration') {
      const val = Number(e.target.value);
      document.querySelectorAll('[data-field="duration"] .chip').forEach((c) => {
        c.classList.toggle('active', Number(c.dataset.value) === val);
      });
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
    [state.tasks, state.settings] = await Promise.all([studio.listTasks(), studio.getSettings()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
  if (!getTask(state.selectedId) && state.tasks.length) {
    state.selectedId = state.tasks[0].id;
  }
  renderSidebar();
  renderDetail(true);

  // 首次启动（未配置 API Key）时引导完成全局设置
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
