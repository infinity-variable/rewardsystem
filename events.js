// ===== 事件绑定 =====
// 所有 DOM 事件在 DOMContentLoaded 时绑定，集中管理。
// 不持有业务逻辑，仅做分发：调用 wheels/ui/state 模块的函数。

import { CONFIG } from './config.js';
import {
  getState, getEmptyState, replaceState, checkMilestones, migrateState, synthFragment,
  markExported, getDaysSinceLastExport
} from './state.js';
import { loadHexagramTexts } from './text.js';
import * as UI from './ui.js';
import {
  drawLot, showLotContextMenu, useTalisman,
  openRewardWheelModal, openRewardWheel, closeRewardWheel,
  spinTenTimes, openTenSpinBonusWheel, openBonusWheel,
  completeChallenge, giveUpChallenge, closeBonusWheel,
  isWheelSpinning, resetBonusState
} from './wheels.js';
import { $ } from './dom.js';
import { recordTaskEvent, recordPageOpen } from './tasks-tracker.js';

// ===== 工具函数：批量绑定 =====
// 通用点击绑定
function bindClick(id, handler) {
  $(id).addEventListener('click', handler);
}

// 关闭弹窗：点击按钮移除指定 modal 的 active 类
function bindCloseButton(btnId, modalId) {
  $(btnId).addEventListener('click', () => {
    $(modalId).classList.remove('active');
  });
}

// 打开弹窗：点击按钮给指定 modal 添加 active 类
function bindOpenButton(btnId, modalId) {
  $(btnId).addEventListener('click', () => {
    $(modalId).classList.add('active');
  });
}

// 翻页绑定：上一页/下一页
function bindPagination(prevId, nextId, prevFn, nextFn) {
  bindClick(prevId, prevFn);
  bindClick(nextId, nextFn);
}

// 关闭当前弹窗并执行后续动作
function bindCloseAndAction(btnId, modalId, action) {
  $(btnId).addEventListener('click', () => {
    $(modalId).classList.remove('active');
    action();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // 抽签
  bindClick('lot-container', drawLot);

  // 签筒右键菜单
  const lotContainer = $('lot-container');
  lotContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showLotContextMenu(e.clientX, e.clientY);
  });
  document.addEventListener('click', () => {
    const menu = $('lot-context-menu');
    if (menu) menu.style.display = 'none';
  });

  // 抽奖 & Spin
  bindClick('lottery-btn', openRewardWheelModal);
  bindClick('spin-btn', openRewardWheel);
  bindClick('spin-ten-btn', spinTenTimes);

  // 奖励转盘关闭
  bindClick('reward-close', closeRewardWheel);
  bindClick('reward-wheel-cancel', closeRewardWheel);

  // 转一次结果弹窗
  bindCloseButton('one-spin-close', 'one-spin-modal');
  bindCloseAndAction('one-spin-bonus-btn', 'one-spin-modal', openBonusWheel);

  // 机缘转盘
  bindClick('challenge-complete', completeChallenge);
  bindClick('challenge-giveup', giveUpChallenge);
  bindClick('bonus-reward-close', closeBonusWheel);
  bindClick('bonus-wheel-cancel', closeBonusWheel);

  // 转十次结果弹窗
  bindCloseButton('ten-spin-close', 'ten-spin-modal');
  bindCloseAndAction('ten-spin-bonus', 'ten-spin-modal', openTenSpinBonusWheel);

  // 设置
  bindClick('settings-btn', () => UI.openSettings());
  bindClick('settings-save', UI.saveSettings);
  bindClick('settings-cancel', UI.closeSettings);
  bindClick('add-milestone', UI.addMilestone);
  bindClick('add-shop-item', UI.addShopItem);
  bindClick('add-task', UI.addTask);
  bindClick('milestone-modal-close', UI.closeMilestoneModal);
  // 设置内 Tab 切换（通用 / 商城商品）
  document.querySelectorAll('#settings-modal .help-tab[data-set-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      UI.switchSettingsTab(tab.dataset.setTab);
    });
  });
  bindClick('draw-modal-close', UI.closeDrawModal);

  // 贝筹商城
  bindClick('shop-btn', UI.openShop);
  bindClick('shop-cancel', UI.closeShop);
  bindClick('shop-buy-btn', UI.confirmShopBuy);
  // 商城内 Tab 切换
  document.querySelectorAll('#shop-modal .shop-sub-tab').forEach(t => {
    t.addEventListener('click', () => UI.switchShopTab(t.dataset.shopTab));
  });

  // 贝筹流水
  bindClick('log-cancel', UI.closeLog);
  bindClick('log-copy-btn', UI.copyLogs);
  bindPagination('log-prev', 'log-next', UI.prevLogPage, UI.nextLogPage);

  // 铜币流水（荷包内）
  bindClick('backpack-cancel', UI.closeBackpack);
  bindClick('coin-log-copy-btn', UI.copyCoinLogs);
  bindPagination('coin-log-prev', 'coin-log-next', UI.prevCoinLogPage, UI.nextCoinLogPage);

  // 荷包页签切换（硬币 / 符箓 / 币胚）
  document.querySelectorAll('#backpack-modal .bp-tabs .help-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      UI.switchBackpackTab(tab.dataset.bpTab);
    });
  });

  // 币胚合成弹窗
  bindClick('fragment-synth-cancel', UI.closeFragmentSynth);
  bindClick('synth-confirm-btn', () => {
    const trigram = synthFragment();
    if (!trigram) {
      UI.showToast('币胚不足，需要集齐 8 个');
      return;
    }
    UI.closeFragmentSynth();
    UI.showToast(`合成成功：获得 ${trigram.name}`);
    UI.refreshActiveBackpackTab();
    UI.updateUI();
    recordTaskEvent('synth_fragment');
  });

  // 符箓使用确认弹窗
  bindClick('talisman-use-cancel', UI.closeTalismanUse);
  bindClick('talisman-use-confirm-btn', () => {
    const id = UI.getPendingTalismanId();
    if (!id) {
      UI.closeTalismanUse();
      return;
    }
    UI.closeTalismanUse();
    useTalisman(id);
    // 使用后刷新荷包当前页签（数量变化 / 可能切换弹窗）
    UI.refreshActiveBackpackTab();
    UI.updateUI();
  });

  // 成就
  bindClick('achievement-btn', UI.openAchievement);
  bindClick('achievement-cancel', UI.closeAchievement);
  bindClick('achievement-congrats-ok', UI.closeAchievementCongrats);
  bindPagination('achievement-prev', 'achievement-next', UI.prevAchievementPage, UI.nextAchievementPage);

  // 任务弹窗
  bindClick('task-btn', UI.openTasksModal);
  bindClick('tasks-cancel', UI.closeTasksModal);
  UI.bindTasksModalTabs();

  // 收集册 & 卦象详情
  bindClick('hexagram-detail-cancel', UI.closeHexagramDetail);
  bindClick('hexagram-detail-close', UI.closeHexagramDetail);
  bindPagination('collection-prev', 'collection-next', UI.prevCollectionPage, UI.nextCollectionPage);

  // 成就弹窗 Tab 切换（成就 / 收集册）
  document.querySelectorAll('#achievement-modal .help-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#achievement-modal .help-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
      });
      document.querySelectorAll('#achievement-modal .help-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === target);
      });
      if (target === 'collection') {
        UI.renderCollection();
      }
    });
  });

  // 顶部铜币/贝筹按钮
  bindClick('coin-info-btn', UI.openBackpack);
  bindClick('points-info-btn', UI.openLog);

  // 设置内说明 & 清零确认
  bindCloseButton('help-close', 'help-modal');
  bindOpenButton('settings-reset', 'reset-modal');
  bindCloseButton('reset-cancel', 'reset-modal');
  bindClick('reset-confirm', () => {
    // 清零：所有数据重置为空状态，包括任务/里程碑/商城等设置
    const fresh = getEmptyState();
    replaceState(fresh);
    $('reset-modal').classList.remove('active');
    UI.closeSettings();
    UI.showToast('数据已清零');
    console.log('[清零] 所有数据已重置');
  });

  // 导出数据
  bindClick('export-data-btn', () => {
    try {
      const dataStr = JSON.stringify(getState(), null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      a.download = `rewardsystem-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      markExported();
      recordTaskEvent('export_data');
      UI.showToast('数据已导出');
      UI.refreshBackupReminder();
      console.log('[导出] 数据已导出到文件');
    } catch (e) {
      UI.showToast('导出失败');
      console.error('[导出] 失败:', e);
    }
  });

  // 备份提醒：立即导出按钮
  bindClick('backup-reminder-export', () => {
    $('export-data-btn').click();
  });
  // 备份提醒：关闭按钮（仅本次会话隐藏）
  bindClick('backup-reminder-close', () => {
    const el = $('backup-reminder');
    if (el) el.classList.add('hidden');
  });

  // ===== 数据分析看板（隐藏入口，仅供开发者/产品复盘） =====
  // 入口1：URL 带 #analytics 自动打开（面试演示用）
  // 入口2：控制台 openAnalytics() 命令
  bindClick('analytics-cancel', UI.closeAnalyticsDashboard);
  const tryOpenAnalytics = () => {
    if (location.hash === '#analytics') {
      // 清掉 hash，避免刷新时重复打开 / 影响正常 URL
      history.replaceState(null, '', location.pathname);
      UI.openAnalyticsDashboard();
      console.log('[analytics] 看板已打开（hash 入口）');
    }
  };
  tryOpenAnalytics();
  window.addEventListener('hashchange', tryOpenAnalytics);
  window.openAnalytics = () => {
    UI.openAnalyticsDashboard();
    console.log('[analytics] 看板已打开（控制台入口）');
  };
  window.exportAnalyticsCSV = UI.exportAnalyticsFile;

  // 导入数据
  bindClick('import-data-btn', () => {
    $('import-data-file').click();
  });
  $('import-data-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const migrated = migrateState(parsed);
        replaceState(migrated);
        checkMilestones();
        UI.showToast('数据已导入');
        console.log('[导入] 数据已从文件恢复');
      } catch (err) {
        UI.showToast('导入失败：文件格式错误');
        console.error('[导入] 失败:', err);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // 预加载周易文本
  loadHexagramTexts();

  // 点击弹窗背景关闭（旋转期间不允许）
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && !isWheelSpinning()) {
        modal.classList.remove('active');
        if (modal.id === 'bonus-wheel-modal' || modal.id === 'bonus-challenge-modal') {
          resetBonusState();
        }
      }
    });
  });

  // ESC键关闭当前弹窗
  document.addEventListener('keydown', (e) => {
    if (e.key === CONFIG.KEY_ESCAPE) {
      const activeModals = document.querySelectorAll('.modal.active');
      if (activeModals.length > 0 && !isWheelSpinning()) {
        const topModal = activeModals[activeModals.length - 1];
        topModal.classList.remove('active');
        if (topModal.id === 'bonus-wheel-modal' || topModal.id === 'bonus-challenge-modal') {
          resetBonusState();
        }
      }
    }
  });

  // 初始化UI（updateUI 已订阅 state，这里显式触发一次首屏渲染 + 里程碑检查）
  checkMilestones();
  UI.updateUI();
  // 任务系统：刷新按钮可见性 + 记录"打开页面"
  UI.updateTaskButtonVisibility();
  recordPageOpen();

  // 首次访问显示健康游戏忠告
  if (!localStorage.getItem(CONFIG.HEALTH_NOTICE_KEY)) {
    $('health-notice-modal').classList.add('active');
  }
  bindClick('health-notice-confirm', () => {
    localStorage.setItem(CONFIG.HEALTH_NOTICE_KEY, '1');
    $('health-notice-modal').classList.remove('active');
    // 防沉迷关闭后，首次访问自动触发新手引导
    if (!localStorage.getItem(CONFIG.ONBOARDING_KEY)) {
      openOnboarding();
    }
  });

  // ===== 新手引导 wizard =====
  const ONBOARDING_TOTAL = 6;
  let onboardingStep = 0;

  function updateOnboardingUI() {
    document.querySelectorAll('#onboarding-modal .onboarding-step').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.step) === onboardingStep);
    });
    $('onboarding-step-indicator').textContent = `${onboardingStep + 1} / ${ONBOARDING_TOTAL}`;
    $('onboarding-prev').disabled = onboardingStep === 0;
    $('onboarding-next').textContent = onboardingStep === ONBOARDING_TOTAL - 1 ? '开始体验' : '下一步';
  }

  function openOnboarding() {
    onboardingStep = 0;
    updateOnboardingUI();
    $('onboarding-modal').classList.add('active');
  }

  function closeOnboarding(markShown = true) {
    $('onboarding-modal').classList.remove('active');
    if (markShown) localStorage.setItem(CONFIG.ONBOARDING_KEY, '1');
  }

  bindClick('onboarding-skip', () => closeOnboarding(true));
  bindClick('onboarding-prev', () => {
    if (onboardingStep > 0) {
      onboardingStep--;
      updateOnboardingUI();
    }
  });
  bindClick('onboarding-next', () => {
    if (onboardingStep < ONBOARDING_TOTAL - 1) {
      onboardingStep++;
      updateOnboardingUI();
    } else {
      closeOnboarding(true);
    }
  });

  // 设置中「重看引导」入口
  bindClick('replay-onboarding-btn', () => {
    UI.closeSettings();
    openOnboarding();
  });

  // ===== 使用说明 Tab 切换 =====
  document.querySelectorAll('#help-modal .help-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#help-modal .help-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
      });
      document.querySelectorAll('#help-modal .help-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === target);
      });
    });
  });

  // 打开使用说明：默认回到「建议设置」Tab
  bindClick('settings-help', () => {
    document.querySelectorAll('#help-modal .help-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'suggest');
    });
    document.querySelectorAll('#help-modal .help-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === 'suggest');
    });
    $('help-modal').classList.add('active');
  });
});
