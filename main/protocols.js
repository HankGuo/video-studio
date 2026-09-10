'use strict';

// TokenDance 网关视频协议适配层
// 每个适配器把统一任务（task + 标准化素材 items）映射为对应协议的请求/响应。
// items: [{ type:'text', text } | { kind:'image'|'video'|'audio', role, url }]
// role ∈ first_frame | last_frame | reference_image | reference_video | reference_audio | edit_video
// query 统一返回 { status, videoUrl, error }，status ∈ queued|running|succeeded|failed|cancelled|expired

const { APP_URL } = require('./oauth');

// 应用归因（https://tokendance.space/docs/app-attribution）：请求维度统一带 X-App-URL
const RECOVERY_HINTS = {
  top_up_balance: '账户余额不足，请到词元跳动控制台充值后重试（当前 Key 仍然有效）',
  reauthorize_api_key: 'API Key 缺失、已禁用或已过期，请在设置中重新授权或更换 Key',
  api_key_quota: 'API Key 已达周期额度上限，请等待额度刷新或重新授权',
};

function joinUrl(base, suffix) {
  return String(base || '').replace(/\/+$/, '') + suffix;
}

async function requestJson(settings, method, path, body, extraHeaders) {
  const headers = { Authorization: `Bearer ${settings.apiKey}`, 'X-App-URL': APP_URL, ...(extraHeaders || {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(joinUrl(settings.endpoint, path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok || (data && (data.type === 'error' || data.error))) {
    let message =
      (data && data.error && data.error.message) ||
      (data && data.message) ||
      (data ? `请求失败（HTTP ${res.status}）` : `网关返回非 JSON 响应（HTTP ${res.status}）`);
    const recovery = res.headers.get('TokenDance-Recovery-Action');
    if (recovery && RECOVERY_HINTS[recovery]) message += `（${RECOVERY_HINTS[recovery]}）`;
    const err = new Error(message);
    err.httpStatus = res.status;
    err.recoveryAction = recovery || '';
    throw err;
  }
  return data;
}

function promptOf(items) {
  const t = items.find((i) => i.type === 'text');
  return t ? t.text : '';
}

function byRole(items, role) {
  return items.filter((i) => i.role === role);
}

function firstUrl(items, role) {
  const it = byRole(items, role)[0];
  return it ? it.url : undefined;
}

function normalizeDashscope(status) {
  switch (status) {
    case 'PENDING': return 'queued';
    case 'RUNNING': return 'running';
    case 'SUCCEEDED': return 'succeeded';
    case 'CANCELED': return 'cancelled';
    case 'FAILED':
    case 'UNKNOWN':
    default: return 'failed';
  }
}

// HappyHorse 没有独立 ratio 参数，宽高比通过 size（宽*高）表达
const HAPPYHORSE_SIZE = {
  '480P': { '16:9': '854*480', '9:16': '480*854', '1:1': '480*480' },
  '720P': { '16:9': '1280*720', '9:16': '720*1280', '1:1': '960*960' },
  '1080P': { '16:9': '1920*1080', '9:16': '1080*1920', '1:1': '1440*1440' },
};

const ADAPTERS = {
  // MiniMax video_generation_v2：POST /gateway/minimax/v2/video_generation → task_id
  // 查询 GET /gateway/minimax/v2/query/video_generation/{id} → task.status / task.content.url
  minimax: {
    async submit(settings, task, items) {
      const content = items.map((it) => {
        if (it.type === 'text') return { type: 'text', text: it.text };
        const key = it.kind === 'image' ? 'image_url' : it.kind === 'video' ? 'video_url' : 'audio_url';
        return { type: key, [key]: { url: it.url }, role: it.role };
      });
      const payload = {
        model: task.model,
        resolution: task.resolution,
        duration: Number(task.duration),
        content,
      };
      if (task.mode === 'text') payload.ratio = task.ratio;
      const data = await requestJson(settings, 'POST', '/gateway/minimax/v2/video_generation', payload);
      if (!data || !data.task_id) throw new Error('网关响应中缺少 task_id');
      return data.task_id;
    },
    async query(settings, remoteId) {
      const data = await requestJson(settings, 'GET', `/gateway/minimax/v2/query/video_generation/${encodeURIComponent(remoteId)}`);
      const t = data && data.task;
      if (!t) throw new Error('网关响应中缺少 task 字段');
      return {
        status: t.status,
        videoUrl: t.content && t.content.url ? t.content.url : '',
        error: (t.error && t.error.message) || t.message || '',
      };
    },
  },

  // Seedance（火山方舟 Ark）：POST /gateway/ark/v3/generations/tasks
  // 查询 GET 同路径/{id} → status + content.video_url
  seedance: {
    async submit(settings, task, items) {
      const content = items.map((it) => {
        if (it.type === 'text') return { type: 'text', text: it.text };
        const key = it.kind === 'image' ? 'image_url' : it.kind === 'video' ? 'video_url' : 'audio_url';
        return { type: key, [key]: { url: it.url }, role: it.role === 'edit_video' ? 'reference_video' : it.role };
      });
      const payload = {
        model: task.model,
        content,
        resolution: task.resolution,
        ratio: task.ratio,
        duration: Number(task.duration),
      };
      if (task.mode === 'reference') payload.omni_reference_task_type = 'reference';
      if (task.mode === 'edit') {
        payload.omni_reference_task_type = 'edit';
        payload.ratio = 'adaptive';
        payload.duration = -1;
      }
      if (task.audio !== undefined) payload.generate_audio = !!task.audio;
      const data = await requestJson(settings, 'POST', '/gateway/ark/v3/generations/tasks', payload);
      const id = data && (data.id || data.task_id);
      if (!id) throw new Error('网关响应中缺少任务 ID');
      return id;
    },
    async query(settings, remoteId) {
      const data = await requestJson(settings, 'GET', `/gateway/ark/v3/generations/tasks/${encodeURIComponent(remoteId)}`);
      return {
        status: data.status,
        videoUrl: data.content && data.content.video_url ? data.content.video_url : '',
        error: (data.error && data.error.message) || data.message || '',
      };
    },
  },

  // Wan3（阿里百炼）：POST /gateway/alibaba/wan3/v1/video-synthesis → output.task_id
  // 查询 GET /gateway/alibaba/wan3/v1/tasks/{id} → output.task_status / output.video_url
  wan3: {
    async submit(settings, task, items) {
      const media = items
        .filter((it) => it.role)
        .map((it) => ({ type: it.role === 'edit_video' ? 'reference_video' : it.role, url: it.url }));
      const payload = {
        model: task.model,
        input: { prompt: promptOf(items), ...(media.length ? { media } : {}) },
        parameters: {
          resolution: task.resolution,
          ratio: task.mode === 'edit' ? 'adaptive' : task.ratio,
          duration: task.mode === 'edit' ? -1 : Number(task.duration),
          audio: !!task.audio,
          watermark: false,
        },
      };
      const data = await requestJson(settings, 'POST', '/gateway/alibaba/wan3/v1/video-synthesis', payload);
      const id = data && data.output && data.output.task_id;
      if (!id) throw new Error('网关响应中缺少 output.task_id');
      return id;
    },
    async query(settings, remoteId) {
      const data = await requestJson(settings, 'GET', `/gateway/alibaba/wan3/v1/tasks/${encodeURIComponent(remoteId)}`);
      const out = (data && data.output) || {};
      return {
        status: normalizeDashscope(out.task_status),
        videoUrl: out.video_url || '',
        error: out.message || '',
      };
    },
  },

  // HappyHorse（阿里 DashScope 异步）：POST /gateway/alibaba/happyhorse/v1/video-synthesis
  // 查询 GET /gateway/alibaba/happyhorse/v1/tasks/{id} → output.task_status / output.video_url
  happyhorse: {
    async submit(settings, task, items) {
      const input = { prompt: promptOf(items) };
      if (task.mode === 'image') {
        const url = firstUrl(items, 'first_frame');
        if (url) input.img_url = url;
      } else if (task.mode === 'reference') {
        input.ref_images_url = byRole(items, 'reference_image').map((i) => i.url);
      } else if (task.mode === 'edit') {
        const url = firstUrl(items, 'edit_video');
        if (url) input.video_url = url;
        const refs = byRole(items, 'reference_image').map((i) => i.url);
        if (refs.length) input.ref_images_url = refs;
      }
      const sizeMap = HAPPYHORSE_SIZE[task.resolution] || HAPPYHORSE_SIZE['720P'];
      const size = sizeMap[task.ratio] || sizeMap['16:9'];
      const payload = { model: task.model, input, parameters: { size, duration: Number(task.duration) } };
      const data = await requestJson(settings, 'POST', '/gateway/alibaba/happyhorse/v1/video-synthesis', payload, {
        'X-DashScope-Async': 'enable',
      });
      const id = data && data.output && data.output.task_id;
      if (!id) throw new Error('网关响应中缺少 output.task_id');
      return id;
    },
    async query(settings, remoteId) {
      const data = await requestJson(settings, 'GET', `/gateway/alibaba/happyhorse/v1/tasks/${encodeURIComponent(remoteId)}`);
      const out = (data && data.output) || {};
      return {
        status: normalizeDashscope(out.task_status),
        videoUrl: out.video_url || '',
        error: out.message || '',
      };
    },
  },

  // 可灵 Kling：text2video / image2video，POST /gateway/kling/v1/{path} → data.id
  // 查询 GET 同路径/{id} → status: submitted|processing|succeeded|failed，结果在 data[0].outputs[]
  kling: {
    pathFor(task) {
      return task.mode === 'image' ? 'image2video' : 'text2video';
    },
    async submit(settings, task, items) {
      const path = ADAPTERS.kling.pathFor(task);
      const settingsBlock = {
        resolution: String(task.resolution).toLowerCase(),
        duration: Number(task.duration),
        aspect_ratio: task.ratio === 'adaptive' ? '16:9' : task.ratio,
      };
      let payload;
      if (path === 'text2video') {
        payload = { model_name: task.model, prompt: promptOf(items), settings: settingsBlock };
      } else {
        const contents = [{ type: 'prompt', text: promptOf(items) }];
        const first = firstUrl(items, 'first_frame');
        const last = firstUrl(items, 'last_frame');
        if (first) contents.push({ type: 'first_frame', url: first });
        if (last) contents.push({ type: 'last_frame', url: last });
        payload = { model_name: task.model, contents, settings: settingsBlock };
      }
      payload.options = { watermark_info: { enabled: false } };
      const data = await requestJson(settings, 'POST', `/gateway/kling/v1/${path}`, payload);
      const id = data && (data.id || (data.data && data.data.id));
      if (!id) throw new Error('网关响应中缺少 data.id');
      return id;
    },
    async query(settings, remoteId, task) {
      const path = ADAPTERS.kling.pathFor(task || { mode: 'text' });
      const data = await requestJson(settings, 'GET', `/gateway/kling/v1/${path}/${encodeURIComponent(remoteId)}`);
      return klingResult(data);
    },
  },

  // 可灵 Omni：参考图 / 主体 / 视频统一放在 contents，编辑用 base_video，运镜参考用 feature_video
  'kling-omni': {
    async submit(settings, task, items) {
      const contents = [{ type: 'prompt', text: promptOf(items) }];
      let n = 0;
      for (const it of items) {
        if (!it.role) continue;
        n += 1;
        if (it.role === 'first_frame' || it.role === 'last_frame') {
          contents.push({ type: it.role, url: it.url, id: `image_${n}` });
        } else if (it.role === 'reference_image') {
          contents.push({ type: 'refer_image', url: it.url, id: `image_${n}` });
        } else if (it.role === 'edit_video') {
          contents.push({ type: 'base_video', url: it.url, id: `video_${n}` });
        } else if (it.role === 'reference_video') {
          contents.push({ type: 'feature_video', url: it.url, id: `video_${n}` });
        }
      }
      const payload = {
        model_name: task.model,
        contents,
        settings: {
          resolution: String(task.resolution).toLowerCase(),
          aspect_ratio: task.ratio === 'adaptive' ? '16:9' : task.ratio,
          audio: task.audio ? 'original' : 'off',
          multi_shot: false,
        },
      };
      if (task.mode !== 'edit') payload.settings.duration = Number(task.duration);
      const data = await requestJson(settings, 'POST', '/gateway/kling/v1/omni-video', payload);
      const id = data && (data.id || (data.data && data.data.id));
      if (!id) throw new Error('网关响应中缺少 data.id');
      return id;
    },
    async query(settings, remoteId) {
      const data = await requestJson(settings, 'GET', `/gateway/kling/v1/omni-video/${encodeURIComponent(remoteId)}`);
      return klingResult(data);
    },
  },
};

function klingResult(data) {
  const statusMap = { submitted: 'queued', processing: 'running', succeeded: 'succeeded', failed: 'failed' };
  const status = statusMap[data && data.status] || 'running';
  let videoUrl = '';
  const list = Array.isArray(data && data.data) ? data.data : [];
  for (const entry of list) {
    const outputs = (entry && entry.outputs) || [];
    const video = outputs.find((o) => o && o.type === 'video' && o.url);
    if (video) { videoUrl = video.url; break; }
  }
  return { status, videoUrl, error: (data && data.message) || '' };
}

function adapterFor(protocol) {
  const adapter = ADAPTERS[protocol];
  if (!adapter) throw new Error(`暂不支持的协议：${protocol}`);
  return adapter;
}

// 用一个不可能存在的任务 id 探测：404 说明网关与密钥都正常；401/403 说明密钥无效。
async function testConnection(settings) {
  if (!settings.endpoint || !settings.apiKey) return { ok: false, message: '请填写接入点与 API Key' };
  try {
    await requestJson(settings, 'GET', '/gateway/minimax/v2/query/video_generation/__connection_test__');
    return { ok: true, message: '连接正常，密钥有效' };
  } catch (err) {
    if (err.httpStatus === 404) return { ok: true, message: '连接正常，密钥有效' };
    if (err.httpStatus === 401 || err.httpStatus === 403) return { ok: false, message: '密钥无效或未授权，请检查 API Key' };
    return { ok: false, message: `连接失败：${err.message}` };
  }
}

module.exports = { adapterFor, testConnection };
