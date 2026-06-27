// ===== 音效系统 =====
// 统一管理所有音效的预加载、播放与开关状态。
// 开关状态独立存储于 localStorage，不受数据导入/导出/清零影响。

import { CONFIG } from './config.js';

// 音效文件路径
const SOUND_PATHS = {
  shake: 'sound/shake.mp3',
  spin:  'sound/spin.mp3',
  coin:  'sound/coin.mp3',
  bonus: 'sound/bonus.mp3',
  click: 'sound/click.mp3'
};

// 预加载音频对象，避免首次播放延迟
const _audioCache = {};
Object.keys(SOUND_PATHS).forEach(key => {
  const audio = new Audio(SOUND_PATHS[key]);
  audio.preload = 'auto';
  audio.load();
  _audioCache[key] = audio;
});

// 开关状态（独立存储，不受主 state 影响）
let _enabled = localStorage.getItem(CONFIG.SOUND_ENABLED_KEY) !== '0';

export function isSoundEnabled() {
  return _enabled;
}

export function setSoundEnabled(enabled) {
  _enabled = !!enabled;
  localStorage.setItem(CONFIG.SOUND_ENABLED_KEY, _enabled ? '1' : '0');
}

// 播放指定音效（仅在开关开启时播放）
export function playSound(name) {
  if (!_enabled) return;
  const base = _audioCache[name];
  if (!base) return;
  try {
    // 克隆节点以支持快速连续播放
    const audio = base.cloneNode(true);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {
    // 克隆失败时回退到新建 Audio
    try {
      const audio = new Audio(SOUND_PATHS[name]);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e2) {}
  }
}
