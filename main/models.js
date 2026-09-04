'use strict';

// TokenDance 视频模型目录（数据来自 https://tokendance.space/portal/api/models/all，2026-09 快照）
// modes: text=文生 video, image=图生（首帧/首尾帧）, reference=多模态参考, edit=视频编辑
// duration: [min, max]，durationAuto=true 表示支持 -1 智能时长
// ratios 中 'adaptive' 表示宽高比跟随输入素材

const FAMILIES = {
  minimax: { name: 'MiniMax', icon: 'M' },
  wan: { name: '通义万相 Wan', icon: 'W' },
  seedance: { name: 'Seedance 字节', icon: 'S' },
  kling: { name: '可灵 Kling', icon: 'K' },
  happyhorse: { name: 'HappyHorse 阿里', icon: 'H' },
};

const RATIOS_STD = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const RATIOS_ADAPTIVE = ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16'];

const MODELS = [
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    family: 'minimax',
    protocol: 'minimax',
    modes: ['text', 'image', 'reference'],
    resolutions: ['768P', '2K'],
    duration: [1, 15],
    durationAuto: false,
    ratios: RATIOS_STD,
    audio: false,
    badge: '限时 5 折',
    pricing: '768P ¥0.45/秒 · 2K ¥0.72/秒',
    desc: '通用全模态生成模型，原生双声道音视频，最高 15s / 2K',
  },
  {
    id: 'minimax-h3-max',
    name: 'MiniMax H3 Max',
    family: 'minimax',
    protocol: 'minimax',
    modes: ['text', 'image'],
    resolutions: ['480P', '768P'],
    duration: [5, 15],
    durationAuto: false,
    ratios: RATIOS_STD,
    audio: false,
    badge: '限时六折 · 极速',
    pricing: '480P ¥0.198/秒 · 768P ¥0.3/秒',
    desc: 'fal.ai 基于 H3 后训练的极速模型，专为高速视频生成优化',
  },
  {
    id: 'wan3.0-video',
    name: 'Wan3.0',
    family: 'wan',
    protocol: 'wan3',
    modes: ['text', 'image', 'reference', 'edit'],
    resolutions: ['480P', '720P', '1080P'],
    duration: [2, 30],
    durationAuto: true,
    ratios: RATIOS_ADAPTIVE,
    audio: true,
    badge: '',
    pricing: '480P ¥0.21 · 720P ¥0.42 · 1080P ¥0.84 /秒',
    desc: 'all-in-one 视频生成：参考 / 编辑 / 复刻 / 驱动，最长 30 秒',
  },
  {
    id: 'wan3.0-video-prime',
    name: 'Wan3.0 Prime',
    family: 'wan',
    protocol: 'wan3',
    modes: ['text', 'image', 'reference', 'edit'],
    resolutions: ['480P', '720P', '1080P'],
    duration: [2, 30],
    durationAuto: true,
    ratios: RATIOS_ADAPTIVE,
    audio: true,
    badge: '高速版',
    pricing: '480P ¥0.36 · 720P ¥0.72 · 1080P ¥1.44 /秒',
    desc: 'Wan3.0 高速版，能力对齐标准版，端到端速度显著提升',
  },
  {
    id: 'seedance-2.5',
    name: 'Seedance 2.5',
    family: 'seedance',
    protocol: 'seedance',
    modes: ['text', 'image', 'reference', 'edit'],
    resolutions: ['480p', '720p', '1080p'],
    duration: [4, 30],
    durationAuto: true,
    ratios: RATIOS_ADAPTIVE,
    audio: true,
    badge: '旗舰 · 30s',
    pricing: '按输出 token 计费 · 1080p 约 ¥55.44/百万 tokens',
    desc: '长叙事 + 多模态参考（最多 50 个素材）+ 时间戳精准编辑',
  },
  {
    id: 'seedance-2.0',
    name: 'Seedance 2.0',
    family: 'seedance',
    protocol: 'seedance',
    modes: ['text', 'image', 'reference'],
    resolutions: ['480p', '720p', '1080p', '4k'],
    duration: [4, 15],
    durationAuto: true,
    ratios: RATIOS_ADAPTIVE,
    audio: true,
    badge: '最高 4K',
    pricing: '按输出 token 计费 · 4K 约 ¥26/百万 tokens',
    desc: '角色一致性与视觉风格保持突出，支持最高 4K 输出',
  },
  {
    id: 'seedance-2.0-fast',
    name: 'Seedance 2.0 Fast',
    family: 'seedance',
    protocol: 'seedance',
    modes: ['text', 'image', 'reference'],
    resolutions: ['480p', '720p'],
    duration: [4, 15],
    durationAuto: true,
    ratios: RATIOS_ADAPTIVE,
    audio: true,
    badge: '快速 · 限时折扣',
    pricing: '按输出 token 计费 · 720p 约 ¥27.75/百万 tokens',
    desc: '继承 2.0 核心能力，生成速度更快',
  },
  {
    id: 'seedance-2.0-mini',
    name: 'Seedance 2.0 Mini',
    family: 'seedance',
    protocol: 'seedance',
    modes: ['text', 'image', 'reference'],
    resolutions: ['480p', '720p'],
    duration: [4, 15],
    durationAuto: true,
    ratios: RATIOS_ADAPTIVE,
    audio: true,
    badge: '高性价比 · 限时折扣',
    pricing: '按输出 token 计费 · 720p 约 ¥9.2/百万 tokens',
    desc: '面向高频、规模化场景的高性价比选择',
  },
  {
    id: 'kling-3.0',
    name: '可灵 3.0',
    family: 'kling',
    protocol: 'kling',
    modes: ['text', 'image'],
    resolutions: ['720p', '1080p', '4K'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: true,
    badge: '',
    pricing: '720P 无声 ¥0.48 · 有声 ¥0.72 · 1080P 有声 ¥0.96 /秒',
    desc: '快手视频生成模型，首末帧控制构图，可选原生音频',
  },
  {
    id: 'kling-v3-omni',
    name: '可灵 3.0 Omni',
    family: 'kling',
    protocol: 'kling-omni',
    modes: ['text', 'image', 'reference', 'edit'],
    resolutions: ['720p', '1080p'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: true,
    badge: 'Omni 全模态',
    pricing: '价格以平台模型页为准',
    desc: '参考图 / 主体 / 视频统一编排，支持视频编辑与运镜参考',
  },
  {
    id: 'happyhorse-1.1-t2v',
    name: 'HappyHorse 1.1 文生',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['text'],
    resolutions: ['480P', '720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '',
    pricing: '480P ¥0.225 · 720P ¥0.45 · 1080P ¥0.6 /秒',
    desc: '文本语义理解、镜头调度与动态生成全面升级',
  },
  {
    id: 'happyhorse-1.1-i2v',
    name: 'HappyHorse 1.1 图生',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['image'],
    resolutions: ['480P', '720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '',
    pricing: '480P ¥0.225 · 720P ¥0.45 · 1080P ¥0.6 /秒',
    desc: '画面质感、动态表现与跨片段一致性提升',
  },
  {
    id: 'happyhorse-1.1-r2v',
    name: 'HappyHorse 1.1 参考生',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['reference'],
    refImagesOnly: true,
    maxRefImages: 9,
    resolutions: ['480P', '720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '最多 9 张参考图',
    pricing: '480P ¥0.225 · 720P ¥0.45 · 1080P ¥0.6 /秒',
    desc: '主体、场景风格与画面一致性的稳定保持',
  },
  {
    id: 'happyhorse-1.0-t2v',
    name: 'HappyHorse 1.0 文生',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['text'],
    resolutions: ['720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '',
    pricing: '¥0.9/秒 · 1080P ¥1.6/秒',
    desc: '文生视频，720P / 1080P，3–15 秒',
  },
  {
    id: 'happyhorse-1.0-i2v',
    name: 'HappyHorse 1.0 图生',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['image'],
    resolutions: ['720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '',
    pricing: '¥0.9/秒 · 1080P ¥1.6/秒',
    desc: '图生视频，720P / 1080P，3–15 秒',
  },
  {
    id: 'happyhorse-1.0-r2v',
    name: 'HappyHorse 1.0 参考生',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['reference'],
    refImagesOnly: true,
    maxRefImages: 9,
    resolutions: ['720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '',
    pricing: '¥0.9/秒 · 1080P ¥1.6/秒',
    desc: '多张参考图融合主体角色，生成流畅视频',
  },
  {
    id: 'happyhorse-1.0-video-edit',
    name: 'HappyHorse 1.0 视频编辑',
    family: 'happyhorse',
    protocol: 'happyhorse',
    modes: ['edit'],
    resolutions: ['720P', '1080P'],
    duration: [3, 15],
    durationAuto: false,
    ratios: ['16:9', '9:16', '1:1'],
    audio: false,
    badge: '',
    pricing: '¥0.9/秒 · 1080P ¥1.6/秒',
    desc: '输入视频 + 参考图，完成风格变换、局部替换等编辑',
  },
];

const DEFAULT_MODEL = 'minimax-h3';

// 平台协议标识 → 适配器协议
const PROTOCOL_MAP = {
  'minimax:video_generation_v2': 'minimax',
  'seedance:generations': 'seedance',
  'wan3:video-synthesis': 'wan3',
  'happyhorse:video-synthesis': 'happyhorse',
  'kling:text2video': 'kling',
  'kling:image2video': 'kling',
  'kling:omni-video': 'kling-omni',
};

// 新上架模型（内置目录未收录）按协议给出保守的能力默认值；
// 超出模型实际能力的参数会在提交时被网关校验并报错
const PROTOCOL_DEFAULTS = {
  minimax: { modes: ['text', 'image'], resolutions: ['768P'], duration: [1, 15], durationAuto: false, ratios: RATIOS_STD, audio: false },
  seedance: { modes: ['text', 'image', 'reference'], resolutions: ['480p', '720p', '1080p'], duration: [4, 15], durationAuto: true, ratios: RATIOS_ADAPTIVE, audio: true },
  wan3: { modes: ['text', 'image', 'reference', 'edit'], resolutions: ['480P', '720P', '1080P'], duration: [2, 30], durationAuto: true, ratios: RATIOS_ADAPTIVE, audio: true },
  happyhorse: { modes: ['text', 'image', 'reference'], resolutions: ['720P', '1080P'], duration: [3, 15], durationAuto: false, ratios: ['16:9', '9:16', '1:1'], audio: false },
  kling: { modes: ['text', 'image'], resolutions: ['720p', '1080p'], duration: [3, 15], durationAuto: false, ratios: ['16:9', '9:16', '1:1'], audio: true },
  'kling-omni': { modes: ['text', 'image', 'reference', 'edit'], resolutions: ['720p', '1080p'], duration: [3, 15], durationAuto: false, ratios: ['16:9', '9:16', '1:1'], audio: true },
};

const PROTOCOL_FAMILY = {
  minimax: 'minimax', seedance: 'seedance', wan3: 'wan', happyhorse: 'happyhorse', kling: 'kling', 'kling-omni': 'kling',
};

// 合并网关公开模型列表（GET /gateway/v1/models，匿名访问）：
// 内置目录保持完整能力信息；目录之外、但走已知视频协议的新模型自动补入
function mergeRemote(remoteModels) {
  const known = new Set(MODELS.map((m) => m.id));
  const added = [];
  for (const rm of remoteModels || []) {
    if (!rm || !rm.id || known.has(rm.id)) continue;
    const protocols = Array.isArray(rm.supported_protocols) ? rm.supported_protocols : [];
    const protoKey = protocols.find((p) => PROTOCOL_MAP[p]);
    if (!protoKey) continue; // 未知协议族仍需适配器代码，不硬猜
    const protocol = PROTOCOL_MAP[protoKey];
    const defaults = PROTOCOL_DEFAULTS[protocol];
    const rawName = String(rm.name || rm.id);
    const shortName = rawName.includes(':') ? rawName.split(':').pop().trim() : rawName;
    added.push({
      id: rm.id,
      name: shortName,
      family: PROTOCOL_FAMILY[protocol],
      protocol,
      ...defaults,
      badge: '新上架',
      pricing: '价格以平台模型页为准',
      desc: String(rm.description || '').slice(0, 60),
      isRemote: true,
    });
  }
  return MODELS.concat(added);
}

// 模块级在线目录缓存：同步成功后写入，getModel/listModels 无参调用时自动使用
let remoteCache = null;

function setRemoteCache(list) {
  remoteCache = Array.isArray(list) ? list : null;
}

function enrich(m) {
  const fam = FAMILIES[m.family];
  return { ...m, familyName: fam ? fam.name : m.family };
}

function listModels(remoteModels) {
  const remote = remoteModels || remoteCache;
  return (remote ? mergeRemote(remote) : MODELS).map(enrich);
}

function getModel(id, remoteModels) {
  const remote = remoteModels || remoteCache;
  const all = remote ? mergeRemote(remote) : MODELS;
  return all.find((m) => m.id === id) || MODELS.find((m) => m.id === DEFAULT_MODEL);
}

module.exports = { MODELS, FAMILIES, DEFAULT_MODEL, PROTOCOL_MAP, listModels, getModel, mergeRemote, setRemoteCache };
