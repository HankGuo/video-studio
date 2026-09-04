'use strict';

const fs = require('fs');
const path = require('path');

// 出厂默认值（可在应用内修改并保存）
// 开源版本不内置任何密钥：首次启动请在「设置」中填入你在词元跳动平台的 API Key
const DEFAULTS = {
  endpoint: 'https://tokendance.space',
  apiKey: '',
};

// v1 的接入点保存的是具体协议地址（如 …/gateway/minimax/v2），v2 起统一为网关根地址
function normalizeEndpoint(value) {
  const v = String(value || '').trim().replace(/\/+$/, '');
  const idx = v.indexOf('/gateway/');
  return idx > 0 ? v.slice(0, idx) : v;
}

class SettingsStore {
  constructor(file) {
    this.file = file;
    this.data = { ...DEFAULTS };
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...DEFAULTS, ...raw };
      this.data.endpoint = normalizeEndpoint(this.data.endpoint) || DEFAULTS.endpoint;
    } catch { /* 首次启动，使用默认值 */ }
  }

  get() {
    return { ...this.data };
  }

  save(patch) {
    this.data = {
      endpoint: normalizeEndpoint(patch.endpoint ?? this.data.endpoint) || DEFAULTS.endpoint,
      apiKey: String(patch.apiKey ?? this.data.apiKey).trim(),
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    return this.get();
  }
}

module.exports = { SettingsStore, DEFAULTS };
