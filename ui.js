// ===== UI 核心：Toast / 总刷新 / 里程碑进度条 / 贝筹流水 =====
// 子模块（ui-backpack / ui-shop / ui-settings / ui-achievements / ui-collection）
// 负责各自弹窗的渲染，本文件仅保留主界面刷新与贝筹流水，并统一再导出子模块函数，
// 供 events.js 通过 `import * as UI from './ui.js'` 使用。

import { CONFIG } from './config.js';
import {
  getState, subscribe,
  getTotalUnexchanged, findSpinableCoinType, calcMaxTenSpins, claimMilestone,
  getDaysSinceLastExport, canSynthFragment
} from './state.js';
import { showAchievementRedDot, showCollectionTabRedDot } from './achievements.js';
import { $, escapeHtml } from './dom.js';
import { showMilestoneModal } from './ui-settings.js';
import { recordTaskEvent } from './tasks-tracker.js';

export function showToast(msg, duration = CONFIG.TOAST_DURATION_MS) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== UI 总刷新 =====
export function updateUI() {
  const state = getState();
  $('points').textContent = state.points;
  $('coin-total-count').textContent = getTotalUnexchanged();
  updateButtonStates();
  renderProgressBar();
  showAchievementRedDot();
  showCollectionTabRedDot();
  refreshFragmentRedDot();
  refreshBackupReminder();
}

// 币胚红点：币胚数 ≥ 8（可合成）时，荷包按钮和荷包内币胚tab都显示红点
export function refreshFragmentRedDot() {
  const show = canSynthFragment();
  const btnDot = document.querySelector('#coin-info-btn .red-dot');
  if (btnDot) btnDot.classList.toggle('visible', show);
  const tabDot = document.querySelector('#backpack-modal .help-tab[data-bp-tab="fragment"] .red-dot');
  if (tabDot) tabDot.classList.toggle('visible', show);
}

// 备份提醒：距上次导出超过 30 天则显示提示条（从未导出不提醒）
export function refreshBackupReminder() {
  const el = $('backup-reminder');
  if (!el) return;
  const days = getDaysSinceLastExport();
  if (days >= 30) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// 订阅 state 变更，自动刷新 UI
subscribe(updateUI);

function updateButtonStates() {
  const spinBtn = $('spin-btn');
  const spinTenBtn = $('spin-ten-btn');

  const canSpinOnce = findSpinableCoinType() !== null;
  spinBtn.disabled = !canSpinOnce;
  spinBtn.title = canSpinOnce ? '' : '需要某一种铜币达到3枚（太极币可补缺）';

  const maxSpins = calcMaxTenSpins();
  spinTenBtn.disabled = maxSpins < CONFIG.TEN_SPIN_COUNT;
  spinTenBtn.title = maxSpins >= CONFIG.TEN_SPIN_COUNT ? '' : `需要同一种铜币+太极币≥${CONFIG.TEN_SPIN_TOTAL_COINS}才能转十次`;
}

// ===== 里程碑进度条 =====
export function renderProgressBar() {
  const state = getState();
  const chestsContainer = $('progress-chests');
  const fill = $('progress-bar-fill');
  const label = $('progress-label');

  chestsContainer.innerHTML = '';

  const validMilestones = state.milestones.filter(m => m.count > 0);
  const maxMilestone = validMilestones.length > 0 ? Math.max(...validMilestones.map(m => m.count)) : 0;
  const fillPct = maxMilestone > 0 ? Math.min(100, (state.totalInvested / maxMilestone) * 100) : 0;
  fill.style.width = fillPct + '%';

  label.textContent = `${state.totalInvested}`;
  label.style.left = fillPct + '%';

  state.milestones.forEach((m, i) => {
    if (m.count <= 0) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'chest-wrapper';
    const pct = maxMilestone > 0 ? (m.count / maxMilestone) * 100 : 0;
    wrapper.style.left = pct + '%';

    const btn = document.createElement('button');
    btn.className = 'chest-btn';

    const isClaimed = state.claimedMilestones.includes(i);
    const isAchieved = m.achieved;

    if (isClaimed) {
      btn.classList.add('claimed');
      btn.title = '已领取';
    } else if (isAchieved) {
      btn.classList.add('achieved');
      btn.title = '点击领取奖励！';
      // 达成后右上角红点引导
      const dot = document.createElement('span');
      dot.className = 'chest-red-dot';
      btn.appendChild(dot);
      btn.addEventListener('click', () => {
        const claimed = claimMilestone(i);
        if (claimed) {
          showMilestoneModal(claimed.count, claimed.reward);
          // 任务埋点：开箱一个里程碑
          recordTaskEvent('claim_milestone');
          renderProgressBar();
        }
      });
    } else {
      btn.title = `累计 ${m.count} 枚解锁`;
    }

    const lbl = document.createElement('div');
    lbl.className = 'chest-label';
    lbl.textContent = m.count;

    wrapper.appendChild(btn);
    wrapper.appendChild(lbl);
    chestsContainer.appendChild(wrapper);
  });
}

// ===== 通用分页日志渲染器 =====
// 封装分页、空状态、行渲染逻辑，供贝筹流水与铜币流水共用。
// 返回 { render, prev, next, reset } 闭包，内部维护分页状态。
export function createPaginatedLogRenderer({
  containerId, emptyId, paginationId, pageId, prevId, nextId,
  getLogs, showInvested = false
}) {
  let page = 0;
  function render() {
    const container = $(containerId);
    const emptyMsg = $(emptyId);
    const pagination = $(paginationId);
    const logs = [...getLogs()].reverse();
    container.innerHTML = '';

    if (logs.length === 0) {
      emptyMsg.style.display = 'block';
      pagination.style.display = 'none';
      return;
    }
    emptyMsg.style.display = 'none';
    pagination.style.display = 'flex';

    const totalPages = Math.ceil(logs.length / CONFIG.LOG_PER_PAGE);
    if (page >= totalPages) page = totalPages - 1;
    if (page < 0) page = 0;

    const start = page * CONFIG.LOG_PER_PAGE;
    logs.slice(start, start + CONFIG.LOG_PER_PAGE).forEach(log => {
      const row = document.createElement('div');
      row.className = 'log-row';
      const amountClass = log.amount > 0 ? 'positive' : log.amount < 0 ? 'negative' : 'zero';
      const amountText = log.amount > 0 ? `+${log.amount}` : `${log.amount}`;
      const investedCell = showInvested
        ? `<span class="log-invested">已投${log.invested ?? 0}</span>`
        : '';
      row.innerHTML = `
        <span class="log-date">${escapeHtml(log.date)}</span>
        <span class="log-desc">${escapeHtml(log.desc)}</span>
        <span class="log-amount ${amountClass}">${amountText}</span>
        ${investedCell}
      `;
      container.appendChild(row);
    });

    $(pageId).textContent = `${page + 1} / ${totalPages}`;
    $(prevId).disabled = page === 0;
    $(nextId).disabled = page >= totalPages - 1;
  }
  function prev() { if (page > 0) { page--; render(); } }
  function next() { page++; render(); }
  function reset() { page = 0; render(); }
  return { render, prev, next, reset };
}

// 通用流水复制：将日志数组格式化后复制到剪贴板，仅数据源与标题不同。
export function copyLogsToClipboard(logs, title) {
  if (logs.length === 0) {
    showToast('暂无流水记录');
    return;
  }
  const lines = logs.map(log => {
    const amountText = log.amount > 0 ? `+${log.amount}` : `${log.amount}`;
    const invested = log.invested != null ? `  已投${log.invested}` : '';
    return `${log.date}  ${log.desc}  ${amountText}${invested}`;
  });
  const text = title + '\n' + lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('流水已复制到剪贴板');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('流水已复制到剪贴板');
  });
}

// ===== 贝筹流水 =====
const pointLogRenderer = createPaginatedLogRenderer({
  containerId: 'log-list',
  emptyId: 'log-empty',
  paginationId: 'log-pagination',
  pageId: 'log-page-info',
  prevId: 'log-prev',
  nextId: 'log-next',
  getLogs: () => getState().pointLogs
});

export function openLog() {
  pointLogRenderer.reset();
  $('log-points').textContent = getState().points;
  $('log-modal').classList.add('active');
  // 埋点：查看贝筹流水（归藏线任务）
  recordTaskEvent('view_points_log');
}

export function closeLog() {
  $('log-modal').classList.remove('active');
}

export function renderLogList() { pointLogRenderer.render(); }
export function copyLogs() { copyLogsToClipboard(getState().pointLogs, '贝筹流水'); }
export function prevLogPage() { pointLogRenderer.prev(); }
export function nextLogPage() { pointLogRenderer.next(); }

// ===== 再导出子模块，供 events.js 统一使用 =====
export {
  openBackpack, closeBackpack, renderCoinSelect,
  renderCoinLogList, copyCoinLogs, prevCoinLogPage, nextCoinLogPage,
  switchBackpackTab, refreshActiveBackpackTab,
  openFragmentSynth, closeFragmentSynth,
  openTalismanUse, closeTalismanUse, getPendingTalismanId
} from './ui-backpack.js';
export {
  openShop, closeShop, renderShopList, renderShopHistory, switchShopTab, confirmShopBuy
} from './ui-shop.js';
export {
  openSettings, saveSettings, closeSettings, switchSettingsTab,
  addMilestone, addShopItem, addTask,
  showMilestoneModal, closeMilestoneModal, closeDrawModal,
  renderTasks, renderMilestones, renderShopItems
} from './ui-settings.js';
export {
  renderAchievements, openAchievement, showAchievementCongrats,
  closeAchievementCongrats, closeAchievement,
  prevAchievementPage, nextAchievementPage
} from './ui-achievements.js';
export {
  renderCollection, openCollection, closeCollection,
  prevCollectionPage, nextCollectionPage,
  showHexagramDetail, closeHexagramDetail
} from './ui-collection.js';
export {
  openTasksModal, closeTasksModal,
  renderDailyTasks, renderOnboardingLine,
  refreshActiveTaskTab,
  updateTaskButtonVisibility, updateTaskRedDot, updateLineTabsRedDot,
  bindTasksModalTabs
} from './ui-tasks.js';
export {
  openAnalyticsDashboard, closeAnalyticsDashboard, exportAnalyticsFile
} from './analytics.js';
