// ===== 奖励转盘与转十次流程 =====
import { CONFIG, REWARD_SECTORS, getTrigram, getBaguaTypes, getTalisman } from './config.js';
import {
  getState, commit, addPointLog, addCoinLog,
  findSpinableCoinType, calcMaxTenSpins, checkMilestones, rollSpinDrops
} from './state.js';
import { showToast, updateUI } from './ui.js';
import { checkAchievement } from './achievements.js';
import { drawWheel, spinWheel, pickSector, isWheelSpinning } from './wheels.js';
import { setTenSpinBonusCount } from './bonus-wheel.js';
import { $ } from './dom.js';
import { recordTaskEvent } from './tasks-tracker.js';
import { track } from './analytics.js';
import { playSound } from './sound.js';

// 奖励卡片工厂：创建统一的 coin-select-item 奖励展示元素。
// label: 卡片标签文本；points: 数值（showPoints=false 时不显示）；
// labelBg: 标签背景色；options.labelColor/subColor/extraLabelStyle/showPoints 可选。
export function createRewardItem(label, points, labelBg, options = {}) {
  const {
    labelColor = CONFIG.COLOR_WHITE,
    subColor = CONFIG.COLOR_GRAY_SUB,
    extraLabelStyle = '',
    showPoints = true
  } = options;
  const item = document.createElement('div');
  item.className = 'coin-select-item';
  item.style.cursor = 'default';
  item.innerHTML = `
    <div class="coin-icon" style="background-image:url('${CONFIG.IMG_ITEM}');background-size:100% 100%">
      <div class="coin-char spin-tier-char" style="background:${labelBg};color:${labelColor};font-size:0.9rem;${extraLabelStyle}">${label}</div>
    </div>
    ${showPoints ? `<span class="spin-item-sub" style="color:${subColor}">+${points}</span>` : ''}
  `;
  return item;
}

// 掉落物卡片：符箓（黄底方块红字）
function createTalismanDropItem(talismanId, count = 1) {
  const t = getTalisman(talismanId);
  const item = document.createElement('div');
  item.className = 'coin-select-item';
  item.style.cursor = 'default';
  item.innerHTML = `
    <div class="coin-icon" style="background-image:url('${CONFIG.IMG_ITEM}');background-size:100% 100%">
      <div class="talisman-inner">${t.abbr}</div>
    </div>
    <span class="spin-item-sub" style="color:var(--talisman-text);font-weight:bold">符箓${count > 1 ? '×' + count : '+1'}</span>
  `;
  return item;
}

// 掉落物卡片：币胚（灰方块）
function createFragmentDropItem(count = 1) {
  const item = document.createElement('div');
  item.className = 'coin-select-item';
  item.style.cursor = 'default';
  item.innerHTML = `
    <div class="coin-icon" style="background-image:url('${CONFIG.IMG_ITEM}');background-size:100% 100%">
      <div class="fragment-inner">胚</div>
    </div>
    <span class="spin-item-sub" style="color:var(--fragment-text);font-weight:bold">币胚${count > 1 ? '×' + count : '+1'}</span>
  `;
  return item;
}

// 根据单次掉落结果生成掉落卡片数组
function buildDropItems(drops) {
  const items = [];
  if (drops.talisman) items.push(createTalismanDropItem(drops.talisman));
  if (drops.fragment) items.push(createFragmentDropItem());
  return items;
}

export function openRewardWheelModal() {
  const modal = $('reward-wheel-modal');
  const canvas = $('reward-wheel');
  const resultDiv = $('reward-result');
  const closeBtn = $('reward-close');

  resultDiv.textContent = '';
  closeBtn.style.display = 'none';

  canvas.style.transition = 'none';
  canvas.style.transform = 'rotate(0deg)';

  drawWheel(canvas, REWARD_SECTORS);
  updateUI();

  modal.classList.add('active');
}

export function openRewardWheel() {
  if (isWheelSpinning()) return;

  const state = getState();
  const coinType = findSpinableCoinType();
  if (!coinType) {
    showToast('没有可用的铜币');
    return;
  }

  const coinCount = state.unexchangedCoins[coinType] || 0;
  const need = CONFIG.SPIN_COIN_COST;
  const useCoin = Math.min(coinCount, need);
  const useTaiji = need - useCoin;
  const trigram = getTrigram(coinType);

  state.unexchangedCoins[coinType] -= useCoin;
  if (useTaiji > 0) {
    state.unexchangedCoins['taiji'] -= useTaiji;
  }
  state.jar.type = coinType;
  state.jar.count = need;
  state.jar.usedTaiji = useTaiji;
  state.totalInvested += need;
  addCoinLog('spend', -need, `转一次投入 ${trigram.name}`);
  console.log(`[转一次] 扣除${trigram.name}×${useCoin}${useTaiji > 0 ? `，太极×${useTaiji}` : ''}，剩余${trigram.name}=${state.unexchangedCoins[coinType]}，太极=${state.unexchangedCoins['taiji']}`);
  commit();
  checkMilestones();

  openRewardWheelModal();

  setTimeout(async () => {
    const canvas = $('reward-wheel');
    const sectorIndex = pickSector(REWARD_SECTORS);
    await spinWheel(canvas, REWARD_SECTORS, sectorIndex);
    const drops = rollSpinDrops();
    handleRewardResult(sectorIndex, drops);
    // 任务埋点：转一次（含每日"投币1次"）
    recordTaskEvent('spin_once');
    // 分析埋点：转盘漏斗 + 道具掉落（符箓使用率的分母）
    try {
      track('wheel_spin', { drawType: 'single', reward: REWARD_SECTORS[sectorIndex].value });
      if (drops.talisman) track('talisman_gain', { talismanId: drops.talisman });
      if (drops.fragment) track('fragment_gain', {});
    } catch (e) {}
  }, CONFIG.WHEEL_AUTO_SPIN_DELAY);
}

// 奖励结果分发：根据扇区类型路由到对应处理函数
function handleRewardResult(sectorIndex, drops) {
  const state = getState();
  const sector = REWARD_SECTORS[sectorIndex];
  const investedCount = state.jar.count;
  const tierNames = { [CONFIG.TIER_C_POINTS]: '丙等', [CONFIG.TIER_B_POINTS]: '乙等', [CONFIG.TIER_A_POINTS]: '甲等', [CONFIG.TIER_S_POINTS]: '至尊' };
  const tierColors = { [CONFIG.TIER_C_POINTS]: CONFIG.TIER_C_DISPLAY_COLOR, [CONFIG.TIER_B_POINTS]: CONFIG.TIER_B_COLOR, [CONFIG.TIER_A_POINTS]: CONFIG.TIER_A_COLOR, [CONFIG.TIER_S_POINTS]: CONFIG.TIER_S_DISPLAY_COLOR };

  $('reward-wheel-modal').classList.remove('active');

  if (sector.value === 'bonus') {
    handleBonusSector(state, sector, investedCount, drops);
    return;
  }
  if (sector.value === CONFIG.TIER_S_POINTS) {
    handleJackpotSector(state, sector, investedCount, tierColors, drops);
    return;
  }
  handleNormalSector(state, sector, investedCount, tierNames, tierColors, drops);
}

// 机缘扇区：先给丙等贝筹，展示机缘卡片并显示"进入机缘转盘"按钮
function handleBonusSector(state, sector, investedCount, drops) {
  const bonusTierPoints = CONFIG.BONUS_INITIAL_POINTS;
  state.points += bonusTierPoints;
  addPointLog('earn', bonusTierPoints, '奖励转盘 机缘');
  console.log(`[奖励转盘] 结果=机缘，投入铜币=${investedCount}，先给丙等+${bonusTierPoints}贝筹，进入机缘转盘`);

  const grid = $('one-spin-grid');
  const pointsDiv = $('one-spin-points');
  grid.innerHTML = '';
  const dropItems = buildDropItems(drops);
  grid.style.gridTemplateColumns = `repeat(${1 + dropItems.length}, 1fr)`;
  pointsDiv.textContent = `+${bonusTierPoints} 贝筹`;
  // 抽到机缘：只显示机缘按键，不显示收下
  $('one-spin-bonus-btn').style.display = 'inline-block';
  $('one-spin-close').style.display = 'none';

  grid.appendChild(createRewardItem('机缘', bonusTierPoints, sector.color));
  dropItems.forEach(it => grid.appendChild(it));

  commit();
  playSound('coin');
  $('one-spin-modal').classList.add('active');
}

// 至尊扇区：固定奖励 CONFIG.TIER_S_POINTS
function handleJackpotSector(state, sector, investedCount, tierColors, drops) {
  const actualPoints = CONFIG.TIER_S_POINTS;
  state.points += actualPoints;
  addPointLog('earn', actualPoints, '奖励转盘 至尊');
  console.log(`[奖励转盘] 结果=至尊，投入铜币=${investedCount}，贝筹+${actualPoints}`);

  showNormalRewardResult({
    itemLabel: '至尊',
    actualPoints,
    itemColor: tierColors[CONFIG.TIER_S_POINTS],
    subColor: 'var(--title-red)',
    sector,
    drops
  });
}

// 普通扇区：根据投入铜币数判定是否降级
function handleNormalSector(state, sector, investedCount, tierNames, tierColors, drops) {
  const actualPoints = investedCount >= CONFIG.SPIN_COIN_COST
    ? sector.value
    : Math.min(sector.value, investedCount);
  const tierDown = sector.value > investedCount && investedCount < CONFIG.SPIN_COIN_COST;
  const itemLabel = tierDown ? (tierNames[actualPoints] || `${actualPoints}贝筹`) : sector.label;
  const itemColor = tierColors[actualPoints] || tierColors[sector.value];

  state.points += actualPoints;
  addPointLog('earn', actualPoints, `奖励转盘 ${sector.label}`);
  const taijiNote = state.jar.usedTaiji > 0 ? `（含太极币×${state.jar.usedTaiji}）` : '';
  console.log(`[奖励转盘] 结果=${sector.label}，投入铜币=${investedCount}${taijiNote}，贝筹+${actualPoints}${tierDown ? '（降级）' : ''}`);

  showNormalRewardResult({
    itemLabel, actualPoints, itemColor, subColor: CONFIG.COLOR_GRAY_SUB, sector, drops
  });
}

// 普通奖励结果展示（至尊/普通共用）：渲染卡片、清空 jar、commit、弹窗
function showNormalRewardResult({ itemLabel, actualPoints, itemColor, subColor, sector, drops }) {
  const grid = $('one-spin-grid');
  const pointsDiv = $('one-spin-points');
  grid.innerHTML = '';
  const dropItems = buildDropItems(drops || {});
  grid.style.gridTemplateColumns = `repeat(${1 + dropItems.length}, 1fr)`;
  // 未抽到机缘：只显示收下，不显示机缘键
  $('one-spin-bonus-btn').style.display = 'none';
  $('one-spin-close').style.display = 'block';

  grid.appendChild(createRewardItem(itemLabel, actualPoints, itemColor, { subColor }));
  dropItems.forEach(it => grid.appendChild(it));
  pointsDiv.textContent = `+${actualPoints} 贝筹`;

  getState().jar = { type: null, count: 0, usedTaiji: 0 };
  commit();

  playSound('coin');
  $('one-spin-modal').classList.add('active');
}

export function closeRewardWheel() {
  $('reward-wheel-modal').classList.remove('active');
}

// ===== 转十次流程 =====
export function spinTenTimes() {
  if (isWheelSpinning()) return;
  const state = getState();
  const maxSpins = calcMaxTenSpins();
  if (maxSpins < CONFIG.TEN_SPIN_COUNT) {
    showToast(`需要同一种铜币+太极币≥${CONFIG.TEN_SPIN_TOTAL_COINS}才能转十次`);
    return;
  }

  const deductedCoins = {};
  const taijiCount = state.unexchangedCoins['taiji'] || 0;
  let spinCoinType = null;
  // 第一轮：优先找纯八卦币 >= 30 的（不消耗太极币）
  for (const t of getBaguaTypes()) {
    const coinCount = state.unexchangedCoins[t.id] || 0;
    if (coinCount >= CONFIG.TEN_SPIN_TOTAL_COINS) {
      spinCoinType = t.id;
      break;
    }
  }
  // 第二轮：再找需要太极币补齐的
  if (!spinCoinType) {
    for (const t of getBaguaTypes()) {
      const coinCount = state.unexchangedCoins[t.id] || 0;
      if (coinCount + taijiCount >= CONFIG.TEN_SPIN_TOTAL_COINS) {
        spinCoinType = t.id;
        break;
      }
    }
  }
  if (!spinCoinType) {
    showToast(`需要同一种铜币+太极币≥${CONFIG.TEN_SPIN_TOTAL_COINS}才能转十次`);
    return;
  }

  const useCoin = Math.min(state.unexchangedCoins[spinCoinType], CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  state.unexchangedCoins[spinCoinType] -= useCoin;
  if (useTaiji > 0) {
    state.unexchangedCoins['taiji'] -= useTaiji;
    deductedCoins['taiji'] = useTaiji;
  }
  deductedCoins[spinCoinType] = useCoin;

  const deductCount = CONFIG.TEN_SPIN_TOTAL_COINS;
  state.totalInvested += deductCount;
  addCoinLog('spend', -deductCount, '转十次投入');
  console.log(`[转十次] 扣除铜币：`, deductedCoins);
  commit();
  checkMilestones();

  let totalPoints = 0;
  const results = [];
  let bonusCount = 0;
  const talismanDrops = {};  // id -> 数量
  let fragmentDrops = 0;

  for (let i = 0; i < CONFIG.TEN_SPIN_COUNT; i++) {
    const sectorIndex = pickSector(REWARD_SECTORS);
    const sector = REWARD_SECTORS[sectorIndex];

    if (sector.value === 'bonus') {
      bonusCount++;
      results.push({ label: '机缘', points: 0, color: sector.color });
    } else if (sector.value === CONFIG.TIER_S_POINTS) {
      totalPoints += CONFIG.TIER_S_POINTS;
      results.push({ label: '至尊', points: CONFIG.TIER_S_POINTS, color: sector.color });
    } else {
      totalPoints += sector.value;
      results.push({ label: sector.label, points: sector.value, color: sector.color });
    }

    // 每次转盘独立判定符箓 / 币胚掉落
    const drops = rollSpinDrops();
    if (drops.talisman) talismanDrops[drops.talisman] = (talismanDrops[drops.talisman] || 0) + 1;
    if (drops.fragment) fragmentDrops++;
  }

  // 非机缘贝筹立即发放
  state.points += totalPoints;
  addPointLog('earn', totalPoints, `转十次（${deductCount}枚）`);

  const hasJackpotOrBonus = results.some(r => r.label === '至尊' || r.label === '机缘');
  if (!hasJackpotOrBonus) {
    checkAchievement('unlucky');
  }

  setTenSpinBonusCount(bonusCount);
  commit();

  showTenSpinResult(results, totalPoints, bonusCount, deductCount, talismanDrops, fragmentDrops);
  // 任务埋点：转十次（不算每日"投币1次"，单次转盘已记录）
  recordTaskEvent('spin_ten');
  // 分析埋点：十连转盘聚合为一次事件
  try {
    track('wheel_spin', { drawType: 'ten', talismanCount: talismanDrops.length, fragmentCount: fragmentDrops.length });
    talismanDrops.forEach(id => track('talisman_gain', { talismanId: id }));
  } catch (e) {}
}

function showTenSpinResult(results, totalPoints, bonusCount, deductCount, talismanDrops, fragmentDrops) {
  const modal = $('ten-spin-modal');
  const gridDiv = $('ten-spin-grid');
  const pointsDiv = $('ten-spin-points');
  const bonusBtn = $('ten-spin-bonus');
  const closeBtn = $('ten-spin-close');

  gridDiv.innerHTML = '';
  gridDiv.className = 'draw-ten-grid';

  results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'coin-select-item';
    item.style.cursor = 'default';
    let subText = '';
    if (r.label === '机缘') {
      subText = '<span class="spin-item-sub" style="font-size:1rem">🎉</span>';
    } else if (r.label === '至尊') {
      subText = `<span class="spin-item-sub" style="color:var(--title-red);font-weight:bold">+${CONFIG.TIER_S_POINTS}</span>`;
    } else {
      subText = `<span class="spin-item-sub" style="color:${CONFIG.COLOR_GRAY_SUB}">+${r.points}</span>`;
    }
    item.innerHTML = `
      <div class="coin-icon" style="background-image:url('${CONFIG.IMG_ITEM}');background-size:100% 100%">
        <div class="coin-char spin-tier-char" style="background:${r.color};color:${CONFIG.COLOR_WHITE};font-size:0.9rem">${r.label}</div>
      </div>
      ${subText}
    `;
    gridDiv.appendChild(item);
  });

  // 掉落的符箓 / 币胚与积分 item 并列排在一起
  Object.keys(talismanDrops).forEach(id => {
    gridDiv.appendChild(createTalismanDropItem(id, talismanDrops[id]));
  });
  if (fragmentDrops > 0) {
    gridDiv.appendChild(createFragmentDropItem(fragmentDrops));
  }

  pointsDiv.textContent = `+${totalPoints} 贝筹`;

  // 抽到机缘：只显示机缘按键，不显示收下；未抽到机缘：只显示收下，不显示机缘键
  if (bonusCount > 0) {
    bonusBtn.style.display = 'inline-block';
    bonusBtn.textContent = `机缘 ×${bonusCount}`;
    closeBtn.style.display = 'none';
  } else {
    bonusBtn.style.display = 'none';
    closeBtn.style.display = 'block';
  }

  playSound('coin');
  modal.classList.add('active');
}
