// ===== 转盘核心：绘制 / 旋转动画 / 选区 / 旋转锁 =====
// 抽签、奖励转盘、机缘转盘的业务逻辑分别位于：
//   lottery.js / reward-wheel.js / bonus-wheel.js
// 本文件仅保留转盘绘制与旋转的共享能力，并统一再导出子模块函数，
// 供 events.js 通过 `import { ... } from './wheels.js'` 使用。

import { CONFIG } from './config.js';

// 旋转锁，防止动画期间重复操作
let _isSpinning = false;
export function isWheelSpinning() { return _isSpinning; }

// 缓存八卦图 Image 对象，避免每次 drawWheel 都重新加载。
// 模块加载时即开始预加载，后续 drawWheel 直接复用。
const _baguaImg = new Image();
_baguaImg.src = CONFIG.IMG_BAGUA;

// ===== 转盘绘制 =====
export function drawWheel(canvas, sectors) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = Math.min(cx, cy) - CONFIG.WHEEL_PADDING;
  let startAngle = -Math.PI / 2;

  sectors.forEach(sector => {
    const sliceAngle = sector.prob * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = sector.color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "LXGW WenKai Medium", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    const textR = r * CONFIG.WHEEL_TEXT_RADIUS_RATIO;
    const lines = sector.label.split('\n');
    lines.forEach((line, i) => {
      const yOffset = (i - (lines.length - 1) / 2) * CONFIG.WHEEL_LINE_HEIGHT;
      ctx.fillText(line, textR, yOffset + (line === '至尊' ? 3 : 0));
    });
    ctx.restore();

    startAngle = endAngle;
  });

  // 中心八卦图（复用缓存的 Image）
  const drawBagua = () => {
    const imgSize = CONFIG.WHEEL_CENTER_IMG_SIZE;
    ctx.drawImage(_baguaImg, cx - imgSize / 2, cy - imgSize / 2, imgSize, imgSize);
  };
  if (_baguaImg.complete) {
    drawBagua();
  } else {
    _baguaImg.onload = drawBagua;
  }
}

// ===== 选区与旋转 =====
export function pickSector(sectors) {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < sectors.length; i++) {
    cumulative += sectors[i].prob;
    if (rand < cumulative) return i;
  }
  return sectors.length - 1;
}

export function spinWheel(canvas, sectors, sectorIndex) {
  return new Promise(resolve => {
    _isSpinning = true;
    const sliceAngle = sectors[sectorIndex].prob * 360;
    let offsetDeg = 0;
    for (let i = 0; i < sectorIndex; i++) {
      offsetDeg += sectors[i].prob * 360;
    }
    const sectorCenter = offsetDeg + sliceAngle / 2;
    const extraRotations = (CONFIG.SPIN_MIN_ROTATIONS + Math.floor(Math.random() * CONFIG.SPIN_MAX_EXTRA_ROTATIONS)) * 360;
    const targetDeg = extraRotations + (360 - sectorCenter);

    canvas.style.transition = 'none';
    canvas.style.transform = 'rotate(0deg)';
    canvas.offsetHeight;

    canvas.style.transition = `transform ${CONFIG.SPIN_DURATION_MS / 1000}s cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
    canvas.style.transform = `rotate(${targetDeg}deg)`;

    setTimeout(() => { _isSpinning = false; resolve(); }, CONFIG.SPIN_DURATION_MS);
  });
}

// ===== 再导出子模块，供 events.js 统一使用 =====
export { drawLot, drawLotTen, showLotContextMenu, useTalisman } from './lottery.js';
export {
  openRewardWheelModal, openRewardWheel, closeRewardWheel, spinTenTimes
} from './reward-wheel.js';
export {
  openTenSpinBonusWheel, openBonusWheel,
  completeChallenge, giveUpChallenge, closeBonusWheel,
  resetBonusState
} from './bonus-wheel.js';
