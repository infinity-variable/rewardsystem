// ===== 设置弹窗：任务 / 里程碑 / 商城商品编辑 =====
import { CONFIG } from './config.js';
import { getState, saveState, commit } from './state.js';
import { $, escapeHtml } from './dom.js';
import { showToast } from './ui.js';
import { recordTaskEvent } from './tasks-tracker.js';

// 模块私有编辑态
let milestoneEditing = new Set();
let taskEditing = new Set();
let shopItemEditing = new Set();

// ===== 设置：任务 =====
export function renderTasks() {
  const state = getState();
  const container = $('task-list');
  container.innerHTML = '';
  state.tasks.forEach((task, i) => {
    const isEditing = taskEditing.has(i);
    const inputsDisabled = !isEditing;
    const row = document.createElement('div');
    row.className = 'milestone-row';
    row.innerHTML = `
      <span class="milestone-label">执行</span>
      <input type="text" class="milestone-input milestone-reward task-name-input" value="${escapeHtml(task.name)}" data-index="${i}" placeholder="任务" ${inputsDisabled ? 'disabled' : ''}>
      <span class="milestone-label">达到</span>
      <input type="number" class="milestone-input milestone-count task-count-input" value="${task.count}" min="1" max="100" data-index="${i}" placeholder="如：15" ${inputsDisabled ? 'disabled' : ''}>
      <input type="text" class="milestone-input task-unit-input" value="${escapeHtml(task.unit || '个')}" data-index="${i}" placeholder="单位" ${inputsDisabled ? 'disabled' : ''}>
      <button class="milestone-edit-btn" data-index="${i}">${isEditing ? '保存' : '编辑'}</button>
      <button class="milestone-del" data-index="${i}">&times;</button>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll('.milestone-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (taskEditing.has(idx)) {
        saveTaskRow(idx);
        taskEditing.delete(idx);
      } else {
        taskEditing.add(idx);
      }
      renderTasks();
    });
  });
  container.querySelectorAll('.milestone-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      state.tasks.splice(idx, 1);
      const newEditing = new Set();
      taskEditing.forEach(ei => {
        if (ei < idx) newEditing.add(ei);
        else if (ei > idx) newEditing.add(ei - 1);
      });
      taskEditing = newEditing;
      renderTasks();
    });
  });
}

function saveTaskRow(index) {
  const state = getState();
  const row = document.querySelector(`#task-list .milestone-row:nth-child(${index + 1})`);
  if (!row) return;
  const name = row.querySelector('.task-name-input').value.trim();
  const count = parseInt(row.querySelector('.task-count-input').value);
  const unit = row.querySelector('.task-unit-input').value.trim() || '个';
  state.tasks[index] = { name: name || '', count: count || 0, unit };
  saveState();
  showToast('任务已保存');
  recordTaskEvent('edit_task');
}

export function addTask() {
  const state = getState();
  if (state.tasks.length >= CONFIG.MAX_TASKS) {
    showToast(`最多设置${CONFIG.MAX_TASKS}个任务`);
    return;
  }
  if (taskEditing.size > 0) {
    showToast('有任务未保存，请先保存');
    return;
  }
  state.tasks.push({ name: '', count: 0, unit: '个' });
  taskEditing.add(state.tasks.length - 1);
  renderTasks();
  recordTaskEvent('add_task');
}

function collectTasksFromUI() {
  const rows = document.querySelectorAll('#task-list .milestone-row');
  const tasks = [];
  rows.forEach(row => {
    const name = row.querySelector('.task-name-input').value.trim();
    const count = parseInt(row.querySelector('.task-count-input').value);
    const unit = row.querySelector('.task-unit-input').value.trim() || '个';
    if (name && count > 0) tasks.push({ name, count, unit });
  });
  return tasks;
}

// ===== 设置：里程碑 =====
export function renderMilestones() {
  const state = getState();
  const container = $('milestone-list');
  container.innerHTML = '';
  state.milestones.forEach((m, i) => {
    const isClaimed = state.claimedMilestones.includes(i);
    const isEditing = milestoneEditing.has(i);
    const inputsDisabled = isClaimed || !isEditing;
    const row = document.createElement('div');
    row.className = 'milestone-row';
    row.innerHTML = `
      <span class="milestone-label">累计</span>
      <input type="number" class="milestone-input milestone-count" value="${m.count}" min="1" data-index="${i}" placeholder="枚数" ${inputsDisabled ? 'disabled' : ''}>
      <span class="milestone-label">枚时，奖励</span>
      <input type="text" class="milestone-input milestone-reward" value="${escapeHtml(m.reward)}" data-index="${i}" placeholder="奖励内容" ${inputsDisabled ? 'disabled' : ''}>
      ${isClaimed ? '' : `<button class="milestone-edit-btn" data-index="${i}">${isEditing ? '保存' : '编辑'}</button>`}
      <button class="milestone-del" data-index="${i}">&times;</button>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll('.milestone-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (milestoneEditing.has(idx)) {
        saveMilestoneRow(idx);
        milestoneEditing.delete(idx);
      } else {
        milestoneEditing.add(idx);
      }
      renderMilestones();
    });
  });
  container.querySelectorAll('.milestone-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      state.milestones.splice(idx, 1);
      state.claimedMilestones = state.claimedMilestones
        .filter(ci => ci !== idx)
        .map(ci => ci > idx ? ci - 1 : ci);
      const newEditing = new Set();
      milestoneEditing.forEach(ei => {
        if (ei < idx) newEditing.add(ei);
        else if (ei > idx) newEditing.add(ei - 1);
      });
      milestoneEditing = newEditing;
      renderMilestones();
    });
  });
}

function saveMilestoneRow(index) {
  const state = getState();
  const row = document.querySelector(`#milestone-list .milestone-row:nth-child(${index + 1})`);
  if (!row) return;
  const count = parseInt(row.querySelector('.milestone-count').value);
  const reward = row.querySelector('.milestone-reward').value.trim();
  const existing = state.milestones[index];
  state.milestones[index] = { count: count || 0, reward, achieved: existing ? existing.achieved : false };
  saveState();
  showToast('里程碑已保存');
}

export function addMilestone() {
  const state = getState();
  if (state.milestones.length >= CONFIG.MAX_MILESTONES) {
    showToast(`最多设置${CONFIG.MAX_MILESTONES}个里程碑`);
    return;
  }
  state.milestones.push({ count: 0, reward: '', achieved: false });
  milestoneEditing.add(state.milestones.length - 1);
  renderMilestones();
  recordTaskEvent('add_milestone');
}

function collectMilestonesFromUI() {
  const state = getState();
  const rows = document.querySelectorAll('#milestone-list .milestone-row');
  const milestones = [];
  rows.forEach((row, i) => {
    const count = parseInt(row.querySelector('.milestone-count').value);
    const reward = row.querySelector('.milestone-reward').value.trim();
    const existing = state.milestones[i] || {};
    milestones.push({ count: count || 0, reward, achieved: existing.achieved || false });
  });
  return milestones;
}

// ===== 设置：商城商品 =====
export function renderShopItems() {
  const state = getState();
  const container = $('shop-item-list');
  container.innerHTML = '';
  state.shopItems.forEach((item, i) => {
    const isEditing = shopItemEditing.has(i);
    const inputsDisabled = !isEditing;
    const row = document.createElement('div');
    row.className = 'milestone-row shop-item-row';
    const limitOnce = item.limit === 'once';
    row.innerHTML = `
      <div class="shop-item-line1">
        <input type="text" class="milestone-input shop-item-emoji-input" value="${escapeHtml(item.emoji || '')}" data-index="${i}" placeholder="表情" maxlength="2" ${inputsDisabled ? 'disabled' : ''}>
        <input type="text" class="milestone-input milestone-reward shop-item-name-input" value="${escapeHtml(item.name)}" data-index="${i}" placeholder="商品名称" ${inputsDisabled ? 'disabled' : ''}>
        <input type="number" class="milestone-input milestone-count shop-item-cost-input" value="${item.cost}" min="1" data-index="${i}" placeholder="贝筹" ${inputsDisabled ? 'disabled' : ''}>
        <button class="milestone-edit-btn" data-index="${i}">${isEditing ? '保存' : '编辑'}</button>
        <button class="milestone-del" data-index="${i}">&times;</button>
      </div>
      <div class="shop-item-line2">
        <label class="shop-limit-label${inputsDisabled ? '' : ' editable'}"><input type="radio" name="shop-limit-${i}" value="once" ${limitOnce ? 'checked' : ''} ${inputsDisabled ? 'disabled' : ''}>只能换一次</label>
        <label class="shop-limit-label${inputsDisabled ? '' : ' editable'}"><input type="radio" name="shop-limit-${i}" value="unlimited" ${!limitOnce ? 'checked' : ''} ${inputsDisabled ? 'disabled' : ''}>能换无限次</label>
      </div>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll('.milestone-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (shopItemEditing.has(idx)) {
        saveShopItemRow(idx);
        shopItemEditing.delete(idx);
      } else {
        shopItemEditing.add(idx);
      }
      renderShopItems();
    });
  });
  container.querySelectorAll('.milestone-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      state.shopItems.splice(idx, 1);
      const newEditing = new Set();
      shopItemEditing.forEach(ei => {
        if (ei < idx) newEditing.add(ei);
        else if (ei > idx) newEditing.add(ei - 1);
      });
      shopItemEditing = newEditing;
      renderShopItems();
      recordTaskEvent('del_shop');
    });
  });
}

function saveShopItemRow(index) {
  const state = getState();
  const row = document.querySelector(`#shop-item-list .milestone-row:nth-child(${index + 1})`);
  if (!row) return;
  const emoji = row.querySelector('.shop-item-emoji-input').value.trim();
  const name = row.querySelector('.shop-item-name-input').value.trim();
  const cost = parseInt(row.querySelector('.shop-item-cost-input').value);
  const limitRadio = row.querySelector('input[name="shop-limit-' + index + '"]:checked');
  const limit = limitRadio ? limitRadio.value : 'unlimited';
  state.shopItems[index] = { emoji: emoji || '', name: name || '', cost: cost || 0, limit };
  saveState();
  showToast('商品已保存');
}

export function addShopItem() {
  const state = getState();
  if (state.shopItems.length >= CONFIG.MAX_SHOP_ITEMS) {
    showToast(`最多设置${CONFIG.MAX_SHOP_ITEMS}个商品`);
    return;
  }
  if (shopItemEditing.size > 0) {
    showToast('有商品未保存，请先保存');
    return;
  }
  state.shopItems.push({ emoji: '', name: '', cost: 0, limit: 'unlimited' });
  state.stats.totalShopItemsAdded++;
  shopItemEditing.add(state.shopItems.length - 1);
  renderShopItems();
  recordTaskEvent('add_shop');
}

function collectShopItemsFromUI() {
  const rows = document.querySelectorAll('#shop-item-list .milestone-row');
  const items = [];
  rows.forEach((row, i) => {
    const emoji = row.querySelector('.shop-item-emoji-input').value.trim();
    const name = row.querySelector('.shop-item-name-input').value.trim();
    const cost = parseInt(row.querySelector('.shop-item-cost-input').value);
    const limitRadio = row.querySelector('input[name="shop-limit-' + i + '"]:checked');
    const limit = limitRadio ? limitRadio.value : 'unlimited';
    if (name && cost > 0) items.push({ emoji: emoji || '', name, cost, limit });
  });
  return items;
}

// ===== 设置弹窗开关 =====
// 当前激活的设置 tab（'general' / 'shop'）
let _currentSetTab = 'general';

// 切换设置内 tab：通用 / 商城商品
export function switchSettingsTab(tab) {
  if (tab === _currentSetTab) return;
  _currentSetTab = tab;
  document.querySelectorAll('#settings-modal .help-tab[data-set-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.setTab === tab);
  });
  document.querySelectorAll('#settings-modal .help-panel[data-set-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.setPanel === tab);
  });
}

export function openSettings(tab) {
  milestoneEditing.clear();
  shopItemEditing.clear();
  taskEditing.clear();
  renderTasks();
  renderMilestones();
  renderShopItems();
  _currentSetTab = tab === 'shop' ? 'shop' : 'general';
  document.querySelectorAll('#settings-modal .help-tab[data-set-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.setTab === _currentSetTab);
  });
  document.querySelectorAll('#settings-modal .help-panel[data-set-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.setPanel === _currentSetTab);
  });
  $('settings-modal').classList.add('active');
}

export function saveSettings() {
  const state = getState();
  const tasks = collectTasksFromUI();
  if (tasks.length === 0) {
    showToast('请至少添加一个任务');
    return;
  }
  state.tasks = tasks;
  state.settings.taskName = tasks[0].name;
  state.settings.taskBaseCount = tasks[0].count;
  state.milestones = collectMilestonesFromUI();
  state.shopItems = collectShopItemsFromUI();
  milestoneEditing.clear();
  shopItemEditing.clear();
  taskEditing.clear();
  commit();
  closeSettings();
  showToast('设置已保存');
}

export function closeSettings() {
  $('settings-modal').classList.remove('active');
}

// ===== 里程碑达成弹窗 =====
export function showMilestoneModal(count, reward) {
  $('milestone-modal-count').textContent = count;
  $('milestone-modal-reward').textContent = reward;
  $('milestone-modal').classList.add('active');
}

export function closeMilestoneModal() {
  $('milestone-modal').classList.remove('active');
}

// ===== 抽签弹窗关闭 =====
export function closeDrawModal() {
  $('draw-modal').classList.remove('active');
}
