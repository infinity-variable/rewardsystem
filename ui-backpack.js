// ===== 荷包（硬币 / 符箓 / 币胚 三页签）与铜币流水 =====
import { CONFIG, TRIGRAMS, COIN_DISPLAY_ORDER, TALISMANS, getTalisman } from './config.js';
import { getState } from './state.js';
import { $ } from './dom.js';
import { createPaginatedLogRenderer, copyLogsToClipboard } from './ui.js';
import { recordTaskEvent } from './tasks-tracker.js';

// 当前激活的荷包页签
let _currentBpTab = 'coin';
// 待使用的符箓 id
let _pendingTalismanId = null;

// 铜币流水渲染器（复用通用分页日志渲染器，showInvested=true 显示已投列）
const coinLogRenderer = createPaginatedLogRenderer({
  containerId: 'coin-log-list',
  emptyId: 'coin-log-empty',
  paginationId: 'coin-log-pagination',
  pageId: 'coin-log-page-info',
  prevId: 'coin-log-prev',
  nextId: 'coin-log-next',
  getLogs: () => getState().coinLogs,
  showInvested: true
});

export function openBackpack() {
  refreshActiveBackpackTab();
  coinLogRenderer.reset();
  $('coin-log-invested').textContent = getState().totalInvested;
  $('backpack-modal').classList.add('active');
  // 埋点：查看荷包内硬币数量（归藏线任务）
  recordTaskEvent('view_coin_count');
}

export function closeBackpack() {
  $('backpack-modal').classList.remove('active');
}

// ===== 页签切换 =====
export function switchBackpackTab(tab) {
  if (tab === _currentBpTab) return;
  _currentBpTab = tab;
  document.querySelectorAll('#backpack-modal .help-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bpTab === tab);
  });
  document.querySelectorAll('#backpack-modal .help-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.bpPanel === tab);
  });
  refreshActiveBackpackTab();
}

// 刷新当前激活页签内容
export function refreshActiveBackpackTab() {
  if (_currentBpTab === 'coin') {
    renderCoinSelect();
    coinLogRenderer.render();
    $('coin-log-invested').textContent = getState().totalInvested;
  } else if (_currentBpTab === 'talisman') {
    renderTalismanGrid();
  } else if (_currentBpTab === 'fragment') {
    renderFragmentDisplay();
  }
}

// ===== 硬币页：硬币选择 + 悬浮说明 =====
function coinTooltipText(t) {
  if (t.id === 'taiji') return '太极币：转十次时可补缺（1 太极 = 1 八卦币）';
  return `${t.name}币：奖励转盘消耗（每转 3 枚，转十次 30 枚）`;
}

export function renderCoinSelect() {
  const state = getState();
  const container = $('coin-select');
  container.innerHTML = '';
  const sorted = COIN_DISPLAY_ORDER
    .map(id => TRIGRAMS.find(tr => tr.id === id))
    .filter(Boolean)
    .sort((a, b) => state.unexchangedCoins[b.id] - state.unexchangedCoins[a.id]);
  sorted.forEach(t => {
    const count = state.unexchangedCoins[t.id];
    const item = document.createElement('div');
    item.className = 'coin-select-item' + (count === 0 ? ' zero' : '');
    item.innerHTML = `
      <div class="coin-icon"><div class="coin-char" style="background:${t.color};color:${CONFIG.COLOR_TAIJI_TEXT}">${t.symbol}</div><span class="coin-count">${count}</span></div>
      <span class="coin-name">${t.name}</span>
      <span class="item-tooltip">${coinTooltipText(t)}</span>
    `;
    container.appendChild(item);
  });
}

// ===== 符箓页 =====
export function renderTalismanGrid() {
  const state = getState();
  const container = $('talisman-grid');
  container.innerHTML = '';
  TALISMANS.forEach(t => {
    const count = state.talismans[t.id] || 0;
    const card = document.createElement('div');
    card.className = 'item-card' + (count === 0 ? ' zero' : '');
    card.innerHTML = `
      <div class="item-square">
        <div class="talisman-inner">${t.abbr}</div>
        <span class="item-count">${count}</span>
      </div>
      <span class="item-name">${t.name}</span>
      <span class="item-tooltip">${t.desc}</span>
    `;
    if (count > 0) {
      card.addEventListener('click', () => openTalismanUse(t.id));
    }
    container.appendChild(card);
  });
}

// ===== 币胚页 =====
export function renderFragmentDisplay() {
  const state = getState();
  const container = $('fragment-display');
  const count = state.fragments || 0;
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'item-card fragment-card' + (count === 0 ? ' zero' : '');
  card.innerHTML = `
    <div class="item-square">
      <div class="fragment-inner">胚</div>
      <span class="item-count">${count}</span>
    </div>
    <span class="item-name">币胚</span>
  `;
  card.addEventListener('click', openFragmentSynth);
  container.appendChild(card);
}

// ===== 币胚合成弹窗 =====
export function openFragmentSynth() {
  const count = getState().fragments || 0;
  $('synth-fragment-count').textContent = count;
  const hint = $('synth-fragment-hint');
  const btn = $('synth-confirm-btn');
  if (count < CONFIG.FRAGMENT_SYNTH_COST) {
    hint.innerHTML = `需要集齐 ${CONFIG.FRAGMENT_SYNTH_COST} 个币胚才能合成`;
    hint.style.color = 'var(--title-red)';
    btn.disabled = true;
  } else {
    hint.innerHTML = `消耗 ${CONFIG.FRAGMENT_SYNTH_COST} 个币胚<br>随机获得一枚八卦硬币`;
    hint.style.color = 'var(--text-secondary)';
    btn.disabled = false;
  }
  $('fragment-synth-modal').classList.add('active');
}

export function closeFragmentSynth() {
  $('fragment-synth-modal').classList.remove('active');
}

// ===== 符箓使用确认弹窗 =====
export function openTalismanUse(id) {
  const t = getTalisman(id);
  if (!t) return;
  _pendingTalismanId = id;
  const abbrEl = $('talisman-use-abbr');
  abbrEl.textContent = t.abbr;
  abbrEl.style.background = 'var(--talisman-bg)';
  abbrEl.style.color = 'var(--talisman-text)';
  abbrEl.style.borderRadius = '8px';
  $('talisman-use-title').textContent = `使用「${t.name}」？`;
  $('talisman-use-name').textContent = t.name;
  $('talisman-use-desc').textContent = t.desc;
  $('talisman-use-modal').classList.add('active');
}

export function closeTalismanUse() {
  $('talisman-use-modal').classList.remove('active');
  _pendingTalismanId = null;
}

export function getPendingTalismanId() {
  return _pendingTalismanId;
}

// ===== 铜币流水 =====
export function renderCoinLogList() { coinLogRenderer.render(); }
export function copyCoinLogs() { copyLogsToClipboard(getState().coinLogs, '铜币流水'); }
export function prevCoinLogPage() { coinLogRenderer.prev(); }
export function nextCoinLogPage() { coinLogRenderer.next(); }
