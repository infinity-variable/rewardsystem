// ===== 任务弹窗：每日签到 + 新手任务（起卦/观象/定数 三条线） =====
import { DAILY_TASKS, ONBOARDING_LINES, TALISMANS } from './config.js';
import {
  getState, commit,
  claimDailyTask, claimOnboardingTask,
  isOnboardingLineComplete, isAllOnboardingComplete,
  hasClaimableTask, hasClaimableOnboardingTask
} from './state.js';
import { $, escapeHtml } from './dom.js';
import { showToast, openLog } from './ui.js';
import { track } from './analytics.js';
import { openRewardWheelModal } from './reward-wheel.js';
import { openBackpack, switchBackpackTab } from './ui-backpack.js';
import { openCollection } from './ui-collection.js';
import { openSettings } from './ui-settings.js';
import { openShop } from './ui-shop.js';

// 主 Tab：起卦 / 观象 / 定数 / 每日签到（三条新手任务线与每日签到同级）
let _currentMainTab = 'qigua';

// 打开任务弹窗
export function openTasksModal() {
  $('tasks-modal').classList.add('active');
  refreshMainTabsVisibility();
  // 新手任务全完成时默认显示每日签到，否则默认显示第一个未完成线
  const showTab = isAllOnboardingComplete() ? 'daily' : _firstActiveLineId();
  _switchMainTab(showTab);
}

export function closeTasksModal() {
  $('tasks-modal').classList.remove('active');
}

// 第一个未完成且已解锁的新手任务线 id
// 解锁规则：line.unlockAfter 指定的前置线完成后才解锁（归藏→起卦；市易→定数；实录→市易）
function _firstActiveLineId() {
  const line = ONBOARDING_LINES.find(l => {
    if (l.unlockAfter && !isOnboardingLineComplete(l.unlockAfter)) return false; // 未解锁
    return !isOnboardingLineComplete(l.id);
  });
  return line ? line.id : 'qigua';
}

// 顶层 Tab 切换
function _switchMainTab(tab) {
  _currentMainTab = tab;
  document.querySelectorAll('#tasks-modal .ts-main-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tsMainTab === tab);
  });
  document.querySelectorAll('#tasks-modal .ts-main-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.tsMainPanel === tab);
  });
  if (tab === 'daily') {
    renderDailyTasks();
  } else {
    renderOnboardingLine(tab);
  }
  updateLineTabsRedDot();
}

// 单条任务线完成时隐藏对应tab；含 unlockAfter 的线在前置线未完成前隐藏
function refreshMainTabsVisibility() {
  let needSwitch = false;
  ONBOARDING_LINES.forEach(line => {
    const tab = document.querySelector(`#tasks-modal .ts-main-tab[data-ts-main-tab="${line.id}"]`);
    if (!tab) return;
    const done = isOnboardingLineComplete(line.id);
    // 含 unlockAfter 的线：前置线未完成前隐藏；前置完成后正常显示（自身完成后再隐藏）
    let locked = false;
    if (line.unlockAfter && !isOnboardingLineComplete(line.unlockAfter)) locked = true;
    const shouldHide = locked || done;
    tab.style.display = shouldHide ? 'none' : '';
    if (shouldHide && _currentMainTab === line.id) needSwitch = true;
  });
  // 若当前停留在已隐藏的线tab，则切回每日签到
  if (needSwitch && _currentMainTab !== 'daily') {
    _switchMainTab('daily');
  }
}

// 顶层 Tab 点击事件绑定（由 events.js 调用一次）
export function bindTasksModalTabs() {
  document.querySelectorAll('#tasks-modal .ts-main-tab').forEach(t => {
    t.addEventListener('click', () => _switchMainTab(t.dataset.tsMainTab));
  });
}

// 渲染每日签到任务
export function renderDailyTasks() {
  const state = getState();
  const container = $('daily-task-list');
  container.innerHTML = '';

  DAILY_TASKS.forEach(def => {
    const raw = (state.dailyTaskState.tasks || {})[def.id];
    const progress = (raw && typeof raw.progress === 'number') ? raw.progress : 0;
    const claimed = !!(raw && raw.claimed);
    const done = progress >= def.target;
    const row = document.createElement('div');
    row.className = 'ts-row' + (claimed ? ' is-claimed' : (done ? ' is-ready' : ''));
    const gotoBtn = done
      ? `<button class="btn-success btn-window ts-goto-done">✓</button>`
      : `<button class="btn-success btn-window ts-goto" data-goto="${def.id}">前往</button>`;
    row.innerHTML = `
      <div class="ts-row-top">
        <div class="ts-row-title">${escapeHtml(def.title)} <span class="ts-progress">${Math.min(progress, def.target)}/${def.target}</span></div>
        ${gotoBtn}
      </div>
      <div class="ts-row-bottom">
        <span class="ts-reward-label">奖励：${escapeHtml(_rewardLabel(def.reward))}</span>
        <button class="btn-success btn-window ts-claim" data-id="${def.id}" ${(!done || claimed) ? 'disabled' : ''}>${claimed ? '已领取' : '领奖'}</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.ts-goto').forEach(btn => {
    btn.addEventListener('click', () => _gotoDaily(btn.dataset.goto));
  });
  container.querySelectorAll('.ts-claim').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = claimDailyTask(btn.dataset.id);
      if (label) {
        commit();
        showToast(`已领取：${label}`);
        renderDailyTasks();
        updateTaskRedDot();
      }
    });
  });
}

// 渲染指定新手任务线（仅展示该线已解锁任务）
export function renderOnboardingLine(lineId) {
  const state = getState();
  const line = ONBOARDING_LINES.find(l => l.id === lineId);
  const panel = $('ts-list-' + lineId);
  if (!panel || !line) return;
  panel.innerHTML = '';

  if (isOnboardingLineComplete(lineId)) {
    panel.innerHTML = '<p class="hint">本条任务线已全部完成！</p>';
    return;
  }

  // 渲染已解锁任务：从前到后，遇到第一个未领取的为止
  const unlocked = [];
  for (const t of line.tasks) {
    unlocked.push(t);
    const st = state.onboardingTaskState[t.id];
    if (!st || !st.claimed) break;
  }

  unlocked.forEach(def => {
    const raw = state.onboardingTaskState[def.id];
    const progress = (raw && typeof raw.progress === 'number') ? raw.progress : 0;
    const claimed = !!(raw && raw.claimed);
    const done = progress >= def.target;
    const row = document.createElement('div');
    row.className = 'ts-row' + (claimed ? ' is-claimed' : (done ? ' is-ready' : ''));
    const gotoBtn = done
      ? `<button class="btn-success btn-window ts-goto-done">✓</button>`
      : `<button class="btn-success btn-window ts-goto" data-goto="${def.goto}">前往</button>`;
    row.innerHTML = `
      <div class="ts-row-top">
        <div class="ts-row-title">${escapeHtml(def.title)} <span class="ts-progress">${Math.min(progress, def.target)}/${def.target}</span></div>
        ${gotoBtn}
      </div>
      <div class="ts-row-bottom">
        <span class="ts-reward-label">奖励：${escapeHtml(_rewardLabel(def.reward))}</span>
        <button class="btn-success btn-window ts-claim-ob" data-id="${def.id}" ${(!done || claimed) ? 'disabled' : ''}>${claimed ? '已领取' : '领奖'}</button>
      </div>
    `;
    panel.appendChild(row);
  });

  panel.querySelectorAll('.ts-goto').forEach(btn => {
    btn.addEventListener('click', () => _gotoOnboarding(btn.dataset.goto));
  });
  panel.querySelectorAll('.ts-claim-ob').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = claimOnboardingTask(btn.dataset.id);
      if (label) {
        commit();
        showToast(`已领取：${label}`);
        renderOnboardingLine(lineId);
        updateTaskRedDot();
        updateLineTabsRedDot();
        refreshMainTabsVisibility();
        // 分析埋点：新手漏斗每完成一步记一次，用于定位流失点
        try { track('onboarding_step', { step: btn.dataset.id, line: lineId }); } catch (e) {}
      }
    });
  });
}

// 奖励文案
function _rewardLabel(reward) {
  if (reward.type === 'random') {
    return reward.options.map(o => _rewardLabel(o)).join(' 或 ');
  }
  if (reward.type === 'fragment') return `币胚×${reward.amount}`;
  if (reward.type === 'talisman') {
    const t = TALISMANS.find(x => x.id === reward.id);
    return `符箓「${t ? t.name : reward.id}」×${reward.amount}`;
  }
  if (reward.type === 'point') return `积分×${reward.amount}`;
  if (reward.type === 'coin') return `八卦硬币×${reward.amount}`;
  return '未知奖励';
}

// 每日任务"前往"路由
function _gotoDaily(taskId) {
  closeTasksModal();
  switch (taskId) {
    case 'daily_open':
      showToast('已打开页面');
      break;
    case 'daily_lottery':
      showToast('请点击签筒进行抽签');
      break;
    case 'daily_invest':
      openRewardWheelModal();
      break;
  }
}

// 新手任务"前往"路由
function _gotoOnboarding(gotoKey) {
  closeTasksModal();
  switch (gotoKey) {
    case 'draw':
      showToast('请点击签筒抽一次');
      break;
    case 'draw_ten':
      showToast('右键签筒使用"抽十次"功能');
      break;
    case 'spin':
      openRewardWheelModal();
      break;
    case 'spin_ten':
      openRewardWheelModal();
      break;
    case 'fragment':
      openBackpack();
      switchBackpackTab('fragment');
      break;
    case 'talisman':
      openBackpack();
      switchBackpackTab('talisman');
      break;
    case 'backpack':
      openBackpack();
      switchBackpackTab('coin');
      break;
    case 'collection':
      openCollection();
      break;
    case 'settings':
      openSettings();
      break;
    case 'settings_shop':
      openSettings('shop');
      break;
    case 'shop':
      openShop();
      break;
    case 'points_log':
      openLog();
      break;
  }
}

// 刷新当前激活的 Tab 内容（外部埋点调用后刷新）
export function refreshActiveTaskTab() {
  if (!_currentMainTab) return;
  // 仅当任务弹窗打开时才刷新
  const modal = $('tasks-modal');
  if (!modal || !modal.classList.contains('active')) return;
  if (_currentMainTab === 'daily') {
    renderDailyTasks();
  } else {
    renderOnboardingLine(_currentMainTab);
  }
  updateTaskRedDot();
  updateLineTabsRedDot();
  refreshMainTabsVisibility();
}

// 任务按钮可见性 & 红点
// 注意：任务按钮本身永不消失（即使新手任务全完成，仍可打开看每日签到）
export function updateTaskButtonVisibility() {
  const btn = $('task-btn');
  if (btn) btn.style.display = '';
  updateTaskRedDot();
  updateLineTabsRedDot();
  refreshMainTabsVisibility();
}

// 任务按钮小红点（复用 .red-dot 类）
export function updateTaskRedDot() {
  const dot = document.querySelector('#task-btn .red-dot');
  if (!dot) return;
  if (hasClaimableTask()) {
    dot.classList.add('visible');
  } else {
    dot.classList.remove('visible');
  }
}

// 各新手任务线 tab 上的小红点：该线有可领取任务时显示
export function updateLineTabsRedDot() {
  ONBOARDING_LINES.forEach(line => {
    const dot = document.querySelector(`#tasks-modal .ts-main-tab[data-ts-main-tab="${line.id}"] .red-dot`);
    if (!dot) return;
    let claimable = false;
    for (const def of line.tasks) {
      const st = getState().onboardingTaskState[def.id];
      if (st && !st.claimed && st.progress >= def.target) { claimable = true; break; }
    }
    dot.classList.toggle('visible', claimable);
  });
  // 每日签到 tab 红点：有可领取任务时显示
  const dailyDot = document.querySelector(`#tasks-modal .ts-main-tab[data-ts-main-tab="daily"] .red-dot`);
  if (dailyDot) {
    const state = getState();
    let dailyClaimable = false;
    for (const def of DAILY_TASKS) {
      const raw = (state.dailyTaskState.tasks || {})[def.id];
      if (raw && !raw.claimed && typeof raw.progress === 'number' && raw.progress >= def.target) {
        dailyClaimable = true; break;
      }
    }
    dailyDot.classList.toggle('visible', dailyClaimable);
  }
}
