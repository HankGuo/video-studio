'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const api = require('./api');

const POLL_MS = 4000;
const TICK_MS = 1500;
const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const RESOLUTIONS = ['768P', '2K'];
const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function now() {
  return Date.now();
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeMedia(media) {
  const clean = {};
  for (const key of ['firstFrame', 'lastFrame', 'refImage', 'refVideo', 'refAudio']) {
    const m = media && media[key];
    if (!m) continue;
    if (m.source === 'url' && m.url) clean[key] = { source: 'url', url: String(m.url).trim() };
    else if (m.source === 'local' && m.path) clean[key] = { source: 'local', path: String(m.path), name: String(m.name || path.basename(m.path)) };
  }
  return clean;
}

// 任务管理器：草稿创建、提交、轮询、视频下载、持久化
class TaskManager extends EventEmitter {
  constructor({ storeFile, videoDir, getSettings }) {
    super();
    this.storeFile = storeFile;
    this.videoDir = videoDir;
    this.getSettings = getSettings;
    this.tasks = [];
    this._saveTimer = null;
    this._tickTimer = null;
    fs.mkdirSync(videoDir, { recursive: true });
    this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.storeFile, 'utf8'));
      this.tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    } catch {
      this.tasks = [];
    }
    // 恢复上次退出时仍在进行中的任务
    for (const t of this.tasks) {
      if (t.status === 'submitting') {
        if (t.remoteId) {
          t.status = 'queued';
        } else {
          t.status = 'failed';
          t.error = '应用在提交过程中退出，请重新提交';
        }
      }
      if (t.status === 'succeeded' && !t.videoPath && t.videoUrl) {
        this._download(t, t.videoUrl); // 上次没下完的视频补下（URL 24h 内有效）
      }
    }
  }

  start() {
    this._tickTimer = setInterval(() => this._pollDue(), TICK_MS);
    this._tickTimer.unref?.();
  }

  stop() {
    if (this._tickTimer) clearInterval(this._tickTimer);
  }

  _find(id) {
    return this.tasks.find((t) => t.id === id);
  }

  _public(t) {
    const out = {};
    for (const [k, v] of Object.entries(t)) if (!k.startsWith('_')) out[k] = v;
    return out;
  }

  list() {
    return this.tasks.map((t) => this._public(t));
  }

  _persist() {
    const payload = JSON.stringify({ tasks: this.list() }, null, 2);
    fs.writeFileSync(this.storeFile, payload);
  }

  _changed() {
    this.emit('changed', this.list());
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist(), 300);
  }

  create(config) {
    const task = {
      id: crypto.randomUUID(),
      remoteId: '',
      mode: ['text', 'image', 'reference'].includes(config.mode) ? config.mode : 'text',
      prompt: String(config.prompt || ''),
      duration: clampInt(config.duration, 1, 15, 6),
      resolution: RESOLUTIONS.includes(config.resolution) ? config.resolution : '768P',
      ratio: RATIOS.includes(config.ratio) ? config.ratio : '16:9',
      media: sanitizeMedia(config.media),
      status: 'draft',
      error: '',
      videoPath: '',
      videoUrl: '',
      downloadError: '',
      createdAt: now(),
      updatedAt: now(),
      submittedAt: 0,
    };
    this.tasks.unshift(task);
    this._changed();
    return this._public(task);
  }

  update(id, patch) {
    const task = this._find(id);
    if (!task) throw new Error('片段不存在');
    if (task.status !== 'draft' && task.status !== 'failed') throw new Error('已提交的片段不能再修改，可复制为新片段');
    if (patch.mode && ['text', 'image', 'reference'].includes(patch.mode)) task.mode = patch.mode;
    if (patch.prompt !== undefined) task.prompt = String(patch.prompt);
    if (patch.duration !== undefined) task.duration = clampInt(patch.duration, 1, 15, task.duration);
    if (patch.resolution && RESOLUTIONS.includes(patch.resolution)) task.resolution = patch.resolution;
    if (patch.ratio && RATIOS.includes(patch.ratio)) task.ratio = patch.ratio;
    if (patch.media !== undefined) task.media = sanitizeMedia(patch.media);
    task.updatedAt = now();
    this._changed();
    return this._public(task);
  }

  duplicate(id) {
    const src = this._find(id);
    if (!src) throw new Error('片段不存在');
    return this.create({
      mode: src.mode,
      prompt: src.prompt,
      duration: src.duration,
      resolution: src.resolution,
      ratio: src.ratio,
      media: src.media,
    });
  }

  remove(id) {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [task] = this.tasks.splice(idx, 1);
    if (task.videoPath) {
      try { fs.unlinkSync(task.videoPath); } catch { /* 文件可能已不存在 */ }
    }
    this._changed();
  }

  async submit(id) {
    const task = this._find(id);
    if (!task) throw new Error('片段不存在');
    if (task.status !== 'draft' && task.status !== 'failed') return this._public(task);
    task.status = 'submitting';
    task.error = '';
    task.updatedAt = now();
    this._changed();
    try {
      const payload = await this._buildPayload(task);
      task.remoteId = await api.submitTask(this.getSettings(), payload);
      task.status = 'queued';
      task.submittedAt = now();
      task._nextPoll = 0;
    } catch (err) {
      task.status = 'failed';
      task.error = err.message;
    }
    task.updatedAt = now();
    this._changed();
    return this._public(task);
  }

  async submitAll() {
    const drafts = this.tasks.filter((t) => t.status === 'draft');
    for (const t of drafts) {
      await this.submit(t.id); // 串行提交，避免瞬时打满网关
    }
    return this.list();
  }

  async _buildPayload(task) {
    const content = [];
    const prompt = (task.prompt || '').trim();
    if (task.mode === 'text' && !prompt) throw new Error('文生视频需要填写提示词');
    if (prompt) content.push({ type: 'text', text: prompt });
    content.push(...(await this._mediaContent(task)));
    if (!content.length) throw new Error('请至少填写提示词或添加素材');
    const payload = {
      model: 'minimax-h3',
      resolution: task.resolution,
      duration: Number(task.duration),
      content,
    };
    if (task.mode === 'text') payload.ratio = task.ratio;
    return payload;
  }

  async _mediaContent(task) {
    const items = [];
    const push = (m, role, kind) => {
      if (!m) return;
      if (m.source === 'url' && m.url) {
        const key = kind === 'image' ? 'image_url' : kind === 'video' ? 'video_url' : 'audio_url';
        items.push({ type: key, [key]: { url: m.url }, role });
        return;
      }
      if (m.source === 'local' && m.path) {
        if (kind !== 'image') throw new Error('参考视频 / 参考音频请使用可公开访问的 URL');
        const mime = IMAGE_MIME[path.extname(m.path).toLowerCase()] || 'image/png';
        const b64 = fs.readFileSync(m.path).toString('base64');
        items.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` }, role });
      }
    };
    if (task.mode === 'image') {
      push(task.media.firstFrame, 'first_frame', 'image');
      push(task.media.lastFrame, 'last_frame', 'image');
      if (!items.length) throw new Error('图生视频需要至少一张首帧图片');
    } else if (task.mode === 'reference') {
      push(task.media.refImage, 'reference_image', 'image');
      push(task.media.refVideo, 'reference_video', 'video');
      push(task.media.refAudio, 'reference_audio', 'audio');
      const hasVisual = items.some((i) => i.role === 'reference_image' || i.role === 'reference_video');
      if (!hasVisual) throw new Error('参考生视频至少需要参考图片或参考视频');
    }
    return items;
  }

  _pollDue() {
    const t = now();
    for (const task of this.tasks) {
      if (
        (task.status === 'queued' || task.status === 'running') &&
        task.remoteId &&
        !task._polling &&
        (task._nextPoll || 0) <= t
      ) {
        this._poll(task);
      }
    }
  }

  async _poll(task) {
    task._polling = true;
    try {
      const remote = await api.queryTask(this.getSettings(), task.remoteId);
      task._nextPoll = now() + POLL_MS;
      this._applyRemote(task, remote);
    } catch (err) {
      task._nextPoll = now() + POLL_MS * 2; // 网络异常时退避
      if (err.httpStatus === 404) {
        task.status = 'failed';
        task.error = '远端任务不存在或已过期';
        task.updatedAt = now();
        this._changed();
      }
    } finally {
      task._polling = false;
    }
  }

  _applyRemote(task, remote) {
    const status = remote.status;
    let dirty = false;
    if ((status === 'queued' || status === 'running') && task.status !== status) {
      task.status = status;
      dirty = true;
    } else if (status === 'succeeded') {
      const url = remote.content && remote.content.url ? remote.content.url : '';
      if (url && url !== task.videoUrl) {
        task.videoUrl = url;
        dirty = true;
      }
      if (task.status !== 'succeeded') {
        task.status = 'succeeded';
        task.updatedAt = now();
        dirty = true;
      }
      if (task.videoUrl && !task.videoPath) this._download(task, task.videoUrl);
    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      if (task.status !== status) {
        task.status = status;
        task.error = (remote.error && remote.error.message) || remote.message || `任务${status}`;
        task.updatedAt = now();
        dirty = true;
      }
    }
    if (dirty) this._changed();
  }

  async _download(task, url) {
    if (task._downloading) return;
    task._downloading = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`视频下载失败（HTTP ${res.status}）`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(this.videoDir, `${task.id}.mp4`);
      fs.writeFileSync(file, buf);
      task.videoPath = file;
      task.downloadError = '';
    } catch (err) {
      task.downloadError = err.message;
    } finally {
      task._downloading = false;
      task.updatedAt = now();
      this._changed();
    }
  }

  async redownload(id) {
    const task = this._find(id);
    if (!task || !task.videoUrl) throw new Error('没有可下载的视频地址');
    await this._download(task, task.videoUrl);
    return this._public(task);
  }
}

module.exports = { TaskManager, RATIOS, RESOLUTIONS };
