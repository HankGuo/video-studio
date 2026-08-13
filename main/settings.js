'use strict';

const fs = require('fs');
const path = require('path');

// 出厂默认值（可在应用内修改并保存）
// 开源版本不内置任何密钥：首次启动请在「设置」中填入你在词元跳动平台的 API Key
const DEFAULTS = {
  endpoint: 'https://tokendance.space/gateway/minimax/v2',
  apiKey: '',
};

class SettingsStore {
  constructor(file) {
    this.file = file;
    this.data = { ...DEFAULTS };
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...DEFAULTS, ...raw };
    } catch { /* 首次启动，使用默认值 */ }
  }

  get() {
    return { ...this.data };
  }

  save(patch) {
    this.data = {
      endpoint: String(patch.endpoint ?? this.data.endpoint).trim(),
      apiKey: String(patch.apiKey ?? this.data.apiKey).trim(),
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    return this.get();
  }
}

module.exports = { SettingsStore, DEFAULTS };
