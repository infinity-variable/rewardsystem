// ===== 贝筹商城 =====
import { getState, commit, addPointLog } from './state.js';
import { $, escapeHtml } from './dom.js';
import { showToast } from './ui.js';
import { recordTaskEvent } from './tasks-tracker.js';
import { track } from './analytics.js';

// 模块私有状态：当前选中的商品索引
let pendingShopIndex = -1;
let shopSubTab = 'current';

export function openShop() {
  pendingShopIndex = -1;
  switchShopTab('current');
  $('shop-points').textContent = getState().points;
  $('shop-modal').classList.add('active');
}

export function closeShop() {
  $('shop-modal').classList.remove('active');
}

// 商城内 Tab 切换（商品 / 历史商品）
export function switchShopTab(tab) {
  shopSubTab = tab;
  document.querySelectorAll('#shop-modal .shop-sub-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.shopTab === tab);
  });
  document.querySelectorAll('#shop-modal .shop-sub-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.shopPanel === tab);
  });
  if (tab === 'current') {
    renderShopList();
  } else {
    renderShopHistory();
  }
}

export function renderShopList() {
  const state = getState();
  const container = $('shop-grid');
  const emptyMsg = $('shop-empty');
  const buyBtn = $('shop-buy-btn');
  container.innerHTML = '';

  if (state.shopItems.length === 0) {
    emptyMsg.style.display = 'block';
    buyBtn.style.display = 'none';
    return;
  }
  emptyMsg.style.display = 'none';

  state.shopItems.forEach((item, i) => {
    const row = document.createElement('div');
    const canAfford = state.points >= item.cost;
    const limitMark = item.limit === 'once' ? '1' : '∞';
    row.className = 'shop-item' + (canAfford ? '' : ' disabled') + (pendingShopIndex === i ? ' selected' : '');
    row.innerHTML = `
      <div class="shop-item-icon">
        ${escapeHtml(item.emoji || '🎁')}
        <span class="shop-item-limit-mark">${limitMark}</span>
      </div>
      <span class="shop-item-name">${escapeHtml(item.name)}</span>
      <span class="shop-item-cost">${item.cost} 贝筹</span>
    `;
    if (canAfford) {
      row.addEventListener('click', () => {
        pendingShopIndex = i;
        renderShopList();
        buyBtn.style.display = 'flex';
      });
    }
    container.appendChild(row);
  });

  if (pendingShopIndex >= 0 && state.points >= state.shopItems[pendingShopIndex].cost) {
    buyBtn.style.display = 'flex';
  } else {
    buyBtn.style.display = 'none';
    pendingShopIndex = -1;
  }
}

// 渲染历史商品（已兑换的「只能换一次」商品）
export function renderShopHistory() {
  const state = getState();
  const container = $('shop-history-grid');
  const emptyMsg = $('shop-history-empty');
  container.innerHTML = '';
  if (!state.shopHistory || state.shopHistory.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';
  state.shopHistory.forEach(item => {
    const row = document.createElement('div');
    row.className = 'shop-item claimed';
    row.innerHTML = `
      <div class="shop-item-icon">
        ${escapeHtml(item.emoji || '🎁')}
        <span class="shop-item-limit-mark">1</span>
      </div>
      <span class="shop-item-name">${escapeHtml(item.name)}</span>
      <span class="shop-item-cost">${item.cost} 贝筹</span>
      <span class="shop-item-once">已兑换</span>
    `;
    container.appendChild(row);
  });
}

export function confirmShopBuy() {
  const state = getState();
  if (pendingShopIndex < 0 || pendingShopIndex >= state.shopItems.length) return;
  const item = state.shopItems[pendingShopIndex];
  if (state.points < item.cost) {
    showToast('贝筹不足');
    return;
  }
  state.points -= item.cost;
  addPointLog('spend', -item.cost, `兑换 ${item.name}`);
  // 「只能换一次」的商品兑换后归档到历史
  if (item.limit === 'once') {
    state.shopItems.splice(pendingShopIndex, 1);
    if (!state.shopHistory) state.shopHistory = [];
    state.shopHistory.unshift({ ...item });
  }
  commit();
  showToast(`兑换成功：${item.name}`);
  pendingShopIndex = -1;
  renderShopList();
  renderShopHistory();
  recordTaskEvent('buy_shop');
  // 分析埋点：商城兑换漏斗终点 + 复购率分子
  try { track('shop_redeem', { itemName: item.name, cost: item.cost, limit: item.limit }); } catch (e) {}
}
