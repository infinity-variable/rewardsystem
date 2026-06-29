// ===== 机缘转盘与挑战流程 =====
// 包含单次机缘、转十次机缘累计、挑战弹窗与结算。
// tenSpinBonusCount 由 reward-wheel.js 的 spinTenTimes 通过 setTenSpinBonusCount 设置。
import { CONFIG, BONUS_SECTORS, bonusDisplayLabel } from './config.js';
import { getState, commit, addPointLog, addCoinLog } from './state.js';
import { drawWheel, spinWheel, pickSector } from './wheels.js';
import { createRewardItem } from './reward-wheel.js';
import { $ } from './dom.js';
import { playSound } from './sound.js';

// 单次机缘状态
let bonusState = {
  investedType: null,
  investedCount: 0,
  currentChallenge: null,
  currentSector: null,
  gaveUp: false
};

// 转十次机缘累计
let tenSpinBonusCount = 0;
let tenSpinBonusPcts = [];
let tenSpinBonusSectors = [];

// 供 reward-wheel.js 的 spinTenTimes 设置机缘次数
export function setTenSpinBonusCount(n) { tenSpinBonusCount = n; }

// 重置机缘状态（供 events.js 弹窗背景/ESC 关闭时调用）
export function resetBonusState() {
  bonusState = {
    investedType: null,
    investedCount: 0,
    currentChallenge: null,
    currentSector: null,
    gaveUp: false
  };
}

// ===== 转十次机缘流程 =====
export function openTenSpinBonusWheel() {
  tenSpinBonusPcts = [];
  tenSpinBonusSectors = [];
  spinNextTenSpinBonus();
}

function spinNextTenSpinBonus() {
  const modal = $('bonus-wheel-modal');
  const canvas = $('bonus-wheel');
  const resultDiv = $('bonus-result');

  resultDiv.textContent = '';

  canvas.style.transition = 'none';
  canvas.style.transform = 'rotate(0deg)';

  drawWheel(canvas, BONUS_SECTORS);
  modal.classList.add('active');

  setTimeout(async () => {
    const sectorIndex = pickSector(BONUS_SECTORS);
    playSound('spin');
    await spinWheel(canvas, BONUS_SECTORS, sectorIndex);
    handleTenSpinBonusResult(sectorIndex);
  }, CONFIG.WHEEL_AUTO_SPIN_DELAY);
}

function handleTenSpinBonusResult(sectorIndex) {
  const sector = BONUS_SECTORS[sectorIndex];
  const resultDiv = $('bonus-result');

  tenSpinBonusPcts.push(sector.pct);
  tenSpinBonusSectors.push(sector);

  const remaining = tenSpinBonusCount - tenSpinBonusPcts.length;

  if (remaining > 0) {
    resultDiv.textContent = `${sector.label}！还有 ${remaining} 次机缘待转...`;
    setTimeout(() => {
      $('bonus-wheel-modal').classList.remove('active');
      setTimeout(() => spinNextTenSpinBonus(), CONFIG.WHEEL_AUTO_SPIN_DELAY);
    }, CONFIG.BONUS_NEXT_DELAY_MS);
    return;
  }

  const hasFreeBonus = tenSpinBonusPcts.some(p => p === CONFIG.BONUS_PCT_FREE);
  const nonFreePcts = tenSpinBonusPcts.filter(p => p > CONFIG.BONUS_PCT_FREE);

  if (nonFreePcts.length === 0) {
    resultDiv.textContent = '🎉 全部白得！无需挑战！';
    setTimeout(() => {
      $('bonus-wheel-modal').classList.remove('active');
      finishTenSpinBonus(false);
    }, CONFIG.BONUS_FREE_DELAY_MS);
    return;
  }

  $('bonus-wheel-modal').classList.remove('active');
  openBonusChallengeModal(nonFreePcts, tenSpinBonusSectors);
}

function openBonusChallengeModal(nonFreePcts, sectors) {
  const state = getState();
  const modal = $('bonus-challenge-modal');
  const challengeText = $('challenge-text');
  const challengeItems = $('challenge-items');
  const challengeActions = $('challenge-actions');
  const rewardArea = $('bonus-reward-area');
  const titleEl = $('bonus-challenge-title');

  challengeItems.innerHTML = '';
  rewardArea.style.display = 'none';
  challengeActions.style.display = 'flex';
  challengeText.style.display = 'block';
  titleEl.textContent = '挑战';

  const taskList = (state.tasks && state.tasks.length > 0) ? state.tasks : [{ name: state.settings.taskName, count: state.settings.taskBaseCount, unit: '个' }];
  const pickedTask = taskList[Math.floor(Math.random() * taskList.length)];
  const baseCount = pickedTask.count;
  const taskUnit = pickedTask.unit || '个';
  const totalPct = nonFreePcts.reduce((s, p) => s + p, 0);
  const challengeCount = Math.round(baseCount * totalPct);
  const pctLabels = nonFreePcts.map(p => p === CONFIG.BONUS_PCT_THREE_QUARTER ? '四分之三' : p === CONFIG.BONUS_PCT_HALF ? '一半' : p === CONFIG.BONUS_PCT_QUARTER ? '四分之一' : p === CONFIG.BONUS_PCT_FREE ? '白得' : `${Math.round(p*100)}%`);
  challengeText.innerHTML = `<div style="color:var(--text-dark);font-size:1.1rem">完成挑战 ${pickedTask.name} ${challengeCount} ${taskUnit}！</div><div style="color:var(--text-secondary);font-size:0.9rem">（${pctLabels.join(' + ')}，原${baseCount * nonFreePcts.length}${taskUnit}）</div><div style="color:var(--text-dark);font-size:1.1rem">完成即可获得${tenSpinBonusCount}枚太极币+${tenSpinBonusCount}个甲等奖励</div>`;

  sectors.forEach(sector => {
    const item = document.createElement('div');
    item.className = 'coin-select-item';
    item.style.cursor = 'default';
    item.innerHTML = `
      <div class="coin-icon" style="background-image:url('${CONFIG.IMG_ITEM}');background-size:100% 100%">
        <div class="coin-char spin-tier-char" style="background:${sector.color};color:${CONFIG.COLOR_WHITE};font-size:0.9rem;width:auto;min-width:44px;padding:0 6px">${bonusDisplayLabel(sector.label)}</div>
      </div>
    `;
    challengeItems.appendChild(item);
  });

  modal.classList.add('active');
  playSound('bonus');
}

function finishTenSpinBonus(gaveUp) {
  const state = getState();
  const challengeText = $('challenge-text');
  const challengeItems = $('challenge-items');
  const challengeActions = $('challenge-actions');
  const rewardArea = $('bonus-reward-area');
  const rewardGrid = $('bonus-reward-grid');
  const titleEl = $('bonus-challenge-title');

  challengeActions.style.display = 'none';
  challengeText.style.display = 'none';
  challengeItems.innerHTML = '';
  titleEl.textContent = '恭喜获得';

  const count = tenSpinBonusCount;
  rewardGrid.innerHTML = '';

  if (gaveUp) {
    const pointsEarned = count * CONFIG.TIER_B_POINTS;
    state.points += pointsEarned;
    addPointLog('earn', pointsEarned, `转十次机缘 放弃 ${count}个乙等`);
    console.log(`[转十次机缘] 放弃，${count}个乙等，贝筹+${pointsEarned}`);
    rewardGrid.appendChild(createRewardItem('乙等', pointsEarned, CONFIG.TIER_B_COLOR));
  } else {
    const pointsEarned = count * CONFIG.TIER_A_POINTS;
    const taijiEarned = count * CONFIG.BONUS_TAIJI_REWARD;
    state.points += pointsEarned;
    state.unexchangedCoins['taiji'] += taijiEarned;
    addPointLog('earn', pointsEarned, `转十次机缘 完成 ${count}个甲等`);
    for (let i = 0; i < taijiEarned; i++) {
      addCoinLog('earn', 1, '转十次机缘 太极币');
    }
    console.log(`[转十次机缘] 完成，${count}个甲等，贝筹+${pointsEarned}，太极币+${taijiEarned}`);
    rewardGrid.appendChild(createRewardItem('甲等', pointsEarned, CONFIG.TIER_A_COLOR));
    rewardGrid.appendChild(createRewardItem('☯', taijiEarned, CONFIG.TAIJI_COIN_COLOR, {
      labelColor: CONFIG.COLOR_TAIJI_TEXT
    }));
  }

  commit();

  tenSpinBonusCount = 0;
  tenSpinBonusPcts = [];
  tenSpinBonusSectors = [];

  rewardArea.style.display = 'block';
  playSound('coin');
}

// ===== 单次机缘转盘流程 =====
export function openBonusWheel() {
  const state = getState();
  const modal = $('bonus-wheel-modal');
  const canvas = $('bonus-wheel');
  const resultDiv = $('bonus-result');

  if (bonusState.investedType === null) {
    bonusState = {
      investedType: state.jar.type,
      investedCount: state.jar.count,
      currentChallenge: null,
      currentSector: null,
      gaveUp: false
    };
  }

  resultDiv.textContent = '';

  canvas.style.transition = 'none';
  canvas.style.transform = 'rotate(0deg)';

  drawWheel(canvas, BONUS_SECTORS);
  modal.classList.add('active');

  setTimeout(async () => {
    const sectorIndex = pickSector(BONUS_SECTORS);
    playSound('spin');
    await spinWheel(canvas, BONUS_SECTORS, sectorIndex);
    handleBonusResult(sectorIndex);
  }, CONFIG.WHEEL_AUTO_SPIN_DELAY);
}

function handleBonusResult(sectorIndex) {
  const state = getState();
  const sector = BONUS_SECTORS[sectorIndex];
  const resultDiv = $('bonus-result');

  if (sector.pct === CONFIG.BONUS_PCT_FREE) {
    console.log(`[机缘转盘] 结果=白得，直接获得甲等+太极币`);
    resultDiv.textContent = '🎉 白得！无需挑战！';
    setTimeout(() => {
      $('bonus-wheel-modal').classList.remove('active');
      finishBonus();
    }, CONFIG.BONUS_FREE_DELAY_MS);
    return;
  }

  $('bonus-wheel-modal').classList.remove('active');

  const taskList = (state.tasks && state.tasks.length > 0) ? state.tasks : [{ name: state.settings.taskName, count: state.settings.taskBaseCount, unit: '个' }];
  const pickedTask = taskList[Math.floor(Math.random() * taskList.length)];
  const baseCount = pickedTask.count;
  const taskUnit = pickedTask.unit || '个';
  const challengeCount = Math.round(baseCount * sector.pct);

  bonusState.currentChallenge = { pct: sector.pct, count: challengeCount };
  bonusState.currentSector = sector;

  const modal = $('bonus-challenge-modal');
  const challengeText = $('challenge-text');
  const challengeItems = $('challenge-items');
  const challengeActions = $('challenge-actions');
  const rewardArea = $('bonus-reward-area');
  const titleEl = $('bonus-challenge-title');

  challengeItems.innerHTML = '';
  rewardArea.style.display = 'none';
  challengeActions.style.display = 'flex';
  challengeText.style.display = 'block';
  titleEl.textContent = '挑战';

  challengeText.innerHTML = `<div style="color:var(--text-dark);font-size:1.1rem">完成挑战 ${pickedTask.name} ${challengeCount} ${taskUnit}！</div><div style="color:var(--text-secondary);font-size:0.9rem">（${sector.label}，原${baseCount}${taskUnit}，减免${baseCount - challengeCount}${taskUnit}）</div><div style="color:var(--text-dark);font-size:1.1rem">完成即可获得1枚太极币+1个甲等奖励</div>`;
  console.log(`[机缘转盘] 结果=${sector.label}挑战，${challengeCount}${taskUnit}${pickedTask.name}（原${baseCount}${taskUnit}）`);

  const item = document.createElement('div');
  item.className = 'coin-select-item';
  item.style.cursor = 'default';
  item.innerHTML = `
    <div class="coin-icon" style="background-image:url('${CONFIG.IMG_ITEM}');background-size:100% 100%">
      <div class="coin-char spin-tier-char" style="background:${sector.color};color:${CONFIG.COLOR_WHITE};font-size:0.9rem;width:auto;min-width:44px;padding:0 6px">${bonusDisplayLabel(sector.label)}</div>
    </div>
  `;
  challengeItems.appendChild(item);

  modal.classList.add('active');
  playSound('bonus');
}

export function completeChallenge() {
  if (tenSpinBonusCount > 0) {
    finishTenSpinBonus(false);
  } else {
    finishBonus();
  }
}

export function giveUpChallenge() {
  if (tenSpinBonusCount > 0) {
    finishTenSpinBonus(true);
  } else {
    bonusState.gaveUp = true;
    finishBonus();
  }
}

function finishBonus() {
  const state = getState();
  const challengeText = $('challenge-text');
  const challengeItems = $('challenge-items');
  const challengeActions = $('challenge-actions');
  const rewardArea = $('bonus-reward-area');
  const rewardGrid = $('bonus-reward-grid');
  const titleEl = $('bonus-challenge-title');

  challengeActions.style.display = 'none';
  challengeText.style.display = 'none';
  challengeItems.innerHTML = '';
  titleEl.textContent = '恭喜获得';

  rewardGrid.innerHTML = '';

  if (bonusState.gaveUp) {
    const pointsEarned = CONFIG.TIER_B_POINTS;
    state.points += pointsEarned;
    addPointLog('earn', pointsEarned, '机缘 放弃挑战 乙等');
    console.log(`[机缘结算] 放弃挑战，乙等奖励，贝筹+${pointsEarned}`);
    rewardGrid.appendChild(createRewardItem('乙等', pointsEarned, CONFIG.TIER_B_COLOR));
  } else {
    const pointsEarned = CONFIG.TIER_A_POINTS;
    const taijiEarned = CONFIG.BONUS_TAIJI_REWARD;
    state.points += pointsEarned;
    state.unexchangedCoins['taiji'] += taijiEarned;
    addPointLog('earn', pointsEarned, '机缘 完成挑战 甲等');
    addCoinLog('earn', taijiEarned, '机缘完成 太极币');
    console.log(`[机缘结算] 完成挑战，甲等奖励，贝筹+${pointsEarned}，获得${taijiEarned}枚太极币`);
    rewardGrid.appendChild(createRewardItem('甲等', pointsEarned, CONFIG.TIER_A_COLOR));
    rewardGrid.appendChild(createRewardItem('☯', taijiEarned, CONFIG.TAIJI_COIN_COLOR, {
      labelColor: CONFIG.COLOR_TAIJI_TEXT
    }));
  }

  state.jar = { type: null, count: 0, usedTaiji: 0 };
  commit();

  bonusState = {
    investedType: null,
    investedCount: 0,
    currentChallenge: null,
    currentSector: null,
    gaveUp: false
  };

  rewardArea.style.display = 'block';
  playSound('coin');
}

export function closeBonusWheel() {
  $('bonus-wheel-modal').classList.remove('active');
  $('bonus-challenge-modal').classList.remove('active');
  $('bonus-reward-area').style.display = 'none';
  resetBonusState();
}
