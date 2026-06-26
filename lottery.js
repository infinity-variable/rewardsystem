// ===== 抽签逻辑 =====
import { CONFIG, TRIGRAMS, HEXAGRAM_NAMES, numberToTrigram, getTalisman } from './config.js';
import { getState, commit, addCoinLog, consumeTalisman, useTalismanYun, addFragments, recordDrawDay } from './state.js';
import { showToast } from './ui.js';
import { showHexagramDetail } from './ui-collection.js';
import { loadHexagramTexts, getDaxiangText } from './text.js';
import { checkAchievements } from './achievements.js';
import { $ } from './dom.js';
import { recordTaskEvent } from './tasks-tracker.js';
import { track } from './analytics.js';

// 单次抽签核心逻辑：生成随机卦象、判定铜币类型、更新状态与统计、收集卦象。
// 返回 { coin, hexagramName, num, earned }，earned=false 表示铜币已达上限未发放。
function _drawSingle(state) {
  const num = Math.floor(Math.random() * CONFIG.HEXAGRAM_COUNT) + 1;
  const hexagramName = HEXAGRAM_NAMES[num];
  const coin = (num % CONFIG.TAIJI_TRIGGER_MOD === 1)
    ? TRIGRAMS.find(t => t.id === 'taiji')
    : numberToTrigram(num);

  const earned = state.unexchangedCoins[coin.id] < CONFIG.COIN_MAX_COUNT;
  if (earned) {
    state.unexchangedCoins[coin.id]++;
    state.stats.totalCoinsEarned++;
    state.stats.trigramDrawCount[coin.id] = (state.stats.trigramDrawCount[coin.id] || 0) + 1;
  }
  if (!state.drawnHexagrams.includes(num)) {
    state.drawnHexagrams.push(num);
    // 标记为新解锁卦，收集册中可领取一个币胚
    if (!state.newHexagrams) state.newHexagrams = [];
    state.newHexagrams.push(num);
  }
  return { coin, hexagramName, num, earned };
}

export function drawLot() {
  const state = getState();
  const doubleActive = !!(state.talismanEffects && state.talismanEffects.doubleDraw);
  const result = _drawSingle(state);
  recordDrawDay();
  if (!result.earned) {
    showToast('已经很多铜币了！');
    return;
  }
  const { coin, hexagramName, num } = result;
  // 「宜·诸事皆宜」：本次抽签奖励翻倍（再发一枚，受上限约束），随后消耗效果
  let bonus = 0;
  if (doubleActive) {
    if (state.unexchangedCoins[coin.id] < CONFIG.COIN_MAX_COUNT) {
      state.unexchangedCoins[coin.id]++;
      state.stats.totalCoinsEarned++;
      state.stats.trigramDrawCount[coin.id] = (state.stats.trigramDrawCount[coin.id] || 0) + 1;
      bonus = 1;
    }
    state.talismanEffects.doubleDraw = false;
  }
  console.log(`[抽签] 铜币=${coin.name}(${coin.symbol})，卦名=${hexagramName}${bonus ? '，诸事皆宜翻倍+1' : ''}`);
  addCoinLog('earn', 1 + bonus, `抽签 ${coin.name}${bonus ? '（翻倍）' : ''}`);
  checkAchievements();
  commit();
  showDrawModal(coin, hexagramName, num, bonus > 0);
  // 任务埋点：抽一次签（含每日"完成1次抽奖"）
  recordTaskEvent('draw_once');
  // 分析埋点：抽签漏斗入口，记录是否触发诸事皆宜翻倍
  try { track('lottery_draw', { drawType: 'single', bonus: bonus > 0, coin: coin.id }); } catch (e) {}
}

export function drawLotTen() {
  const state = getState();
  recordDrawDay();
  const results = [];
  let earnedCount = 0;
  for (let i = 0; i < CONFIG.TEN_SPIN_COUNT; i++) {
    const r = _drawSingle(state);
    if (r.earned) earnedCount++;
    results.push({ coin: r.coin, hexagramName: r.hexagramName, num: r.num });
  }
  if (earnedCount > 0) addCoinLog('earn', earnedCount, '抽签十次');
  checkAchievements();
  commit();
  showDrawTenModal(results);
  // 任务埋点：抽十次签（也算完成每日1次抽奖）
  recordTaskEvent('draw_ten');
  // 分析埋点：十连抽按一次事件记，便于漏斗聚合
  try { track('lottery_draw', { drawType: 'ten', bonus: false, earnedCount }); } catch (e) {}
}

function showDrawModal(trigram, hexagramName, num, doubled = false) {
  const symbolDiv = $('draw-modal-symbol');
  const wrapper = $('draw-modal-coin-wrapper');
  const nameDiv = $('draw-modal-name');
  const hexagramDiv = $('draw-modal-hexagram');

  wrapper.style.display = 'flex';
  hexagramDiv.style.display = '';

  symbolDiv.textContent = trigram.symbol;
  symbolDiv.style.display = 'flex';
  symbolDiv.style.background = trigram.color;
  symbolDiv.style.color = '#1a1a2e';
  symbolDiv.style.borderColor = 'rgba(255,255,255,0.3)';

  nameDiv.textContent = '';
  // 卦名后追加翻倍标记（仅当诸事皆宜生效时）
  hexagramDiv.innerHTML = doubled
    ? `${hexagramName}<span class="draw-doubled-tag">×2（诸事皆宜翻倍）</span>`
    : hexagramName;

  wrapper.onclick = () => {
    showHexagramDetail(num);
    // 任务埋点：在抽奖结果弹窗点击硬币查看卦象
    recordTaskEvent('view_coin');
  };

  const daxiangDiv = $('draw-modal-daxiang');
  daxiangDiv.textContent = '';
  loadHexagramTexts().then(() => {
    daxiangDiv.textContent = getDaxiangText(hexagramName);
  });
  $('draw-modal').classList.add('active');
}

function showDrawTenModal(results) {
  const modal = $('draw-modal');
  const symbolDiv = $('draw-modal-symbol');
  const wrapper = $('draw-modal-coin-wrapper');
  const nameDiv = $('draw-modal-name');
  const hexagramDiv = $('draw-modal-hexagram');

  const oldDetail = $('draw-modal-detail');
  if (oldDetail) oldDetail.remove();

  wrapper.style.display = 'none';
  symbolDiv.textContent = '';
  symbolDiv.style.display = 'none';
  symbolDiv.style.background = '';
  symbolDiv.style.color = '#fff';
  symbolDiv.style.borderColor = 'rgba(255,255,255,0.3)';
  nameDiv.textContent = '十连抽签';

  const daxiangDiv = $('draw-modal-daxiang');
  if (daxiangDiv) daxiangDiv.textContent = '';

  const grid = document.createElement('div');
  grid.className = 'draw-ten-grid';

  loadHexagramTexts().then(() => {
    grid.querySelectorAll('.coin-select-item').forEach((el, idx) => {
      const name = results[idx].hexagramName;
      el.title = getDaxiangText(name) || name;
    });
  });

  results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'coin-select-item';
    item.innerHTML = `
      <div class="coin-icon"><div class="coin-char" style="background:${r.coin.color};color:${CONFIG.COLOR_TAIJI_TEXT}">${r.coin.symbol}</div></div>
      <span class="coin-name">${r.hexagramName}</span>
    `;
    item.title = r.hexagramName;
    item.addEventListener('click', () => showHexagramDetail(r.num));
    grid.appendChild(item);
  });

  nameDiv.appendChild(grid);
  modal.classList.add('active');
}

export function showLotContextMenu(x, y) {
  let menu = $('lot-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'lot-context-menu';
    menu.innerHTML = `<div class="lot-menu-item" id="lot-menu-draw-one">抽一次</div><div class="lot-menu-item" id="lot-menu-draw-ten">抽十次</div>`;
    document.body.appendChild(menu);
    $('lot-menu-draw-one').addEventListener('click', () => {
      menu.style.display = 'none';
      drawLot();
    });
    $('lot-menu-draw-ten').addEventListener('click', () => {
      menu.style.display = 'none';
      drawLotTen();
    });
  }
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
}

// 使用符箓：根据 id 路由到对应效果，已做合法性校验与提示。
// 由 events.js 的符箓使用确认按钮调用。
export function useTalisman(id) {
  const state = getState();
  const t = getTalisman(id);
  if (!t) return;
  if ((state.talismans[id] || 0) <= 0) return;

  let used = false; // 是否成功使用（用于任务埋点）

  // 宜·诸事皆宜：激活下次抽签翻倍，不可叠加
  if (id === 'yi') {
    if (state.talismanEffects && state.talismanEffects.doubleDraw) {
      showToast('该效果已激活');
      return;
    }
    consumeTalisman(id);
    state.talismanEffects.doubleDraw = true;
    commit();
    showToast('诸事皆宜已激活：下次抽签奖励翻倍');
    used = true;
  }
  // 财·招财进宝：随机获得 3 个币胚
  else if (id === 'cai') {
    consumeTalisman(id);
    addFragments(CONFIG.TALISMAN_CAI_FRAGMENT_GAIN);
    commit();
    showToast(`招财进宝：获得 ${CONFIG.TALISMAN_CAI_FRAGMENT_GAIN} 个币胚`);
    used = true;
  }
  // 运·时来运转：把数量最少的硬币类别全部转化为数量最多
  else if (id === 'yun') {
    const res = useTalismanYun();
    if (!res) {
      showToast('需要至少两种硬币类别才能使用');
      return; // 无法转化，不消耗符箓
    }
    consumeTalisman(id);
    commit();
    showToast(`时来运转：${res.from.name}×${res.moved} 转化为 ${res.to.name}`);
    used = true;
  }
  // 成·心想事成：直接抽签一次（drawLot 内部会触发 draw_once 埋点）
  else if (id === 'cheng') {
    consumeTalisman(id);
    commit();
    showToast('心想事成：直接抽签一次');
    used = true;
    drawLot();
  }

  // 任务埋点：使用一张符箓（cheng 已 used，但 drawLot 的 draw_once 不重复触发 use_talisman）
  if (used) {
    recordTaskEvent('use_talisman');
    // 分析埋点：符箓使用率分母 = 获得次数，分子 = 使用次数
    try { track('talisman_use', { talismanId: id }); } catch (e) {}
  }
}
