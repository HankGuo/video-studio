'use strict';

// MiniMax V2 网关 API 客户端（异步任务协议：提交后轮询）

function joinUrl(base, suffix) {
  return String(base || '').replace(/\/+$/, '') + suffix;
}

async function parseResponse(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: res.status, data, text };
}

function toError({ status, data, text }) {
  const message =
    (data && data.error && data.error.message) ||
    (data && data.message) ||
    (data ? `请求失败（HTTP ${status}）` : `网关返回非 JSON 响应（HTTP ${status}）`);
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

function isErrorPayload(data) {
  return data && (data.type === 'error' || data.error);
}

async function submitTask(settings, payload) {
  const res = await fetch(joinUrl(settings.endpoint, '/video_generation'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const parsed = await parseResponse(res);
  if (!res.ok || isErrorPayload(parsed.data)) throw toError(parsed);
  if (!parsed.data || !parsed.data.task_id) throw new Error('网关响应中缺少 task_id');
  return parsed.data.task_id;
}

async function queryTask(settings, taskId) {
  const res = await fetch(joinUrl(settings.endpoint, '/query/video_generation/') + encodeURIComponent(taskId), {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  });
  const parsed = await parseResponse(res);
  if (!res.ok || isErrorPayload(parsed.data)) throw toError(parsed);
  if (!parsed.data || !parsed.data.task) throw new Error('网关响应中缺少 task 字段');
  return parsed.data.task;
}

// 用一个不可能存在的任务 id 探测：404 说明网关与密钥都正常；401/403 说明密钥无效。
async function testConnection(settings) {
  if (!settings.endpoint || !settings.apiKey) return { ok: false, message: '请填写接入点与 API Key' };
  try {
    await queryTask(settings, '__connection_test__');
    return { ok: true, message: '连接正常，密钥有效' };
  } catch (err) {
    if (err.httpStatus === 404) return { ok: true, message: '连接正常，密钥有效' };
    if (err.httpStatus === 401 || err.httpStatus === 403) return { ok: false, message: '密钥无效或未授权，请检查 API Key' };
    return { ok: false, message: `连接失败：${err.message}` };
  }
}

module.exports = { submitTask, queryTask, testConnection };
