// ===== 任务进度埋点统一入口 =====
// 业务模块（lottery/reward-wheel/ui-settings/ui-shop 等）调用 recordEvent，
// 由本模块根据事件名映射到对应每日任务 / 新手任务的 recordDailyProgress / recordOnboardingProgress，
// 自动 commit 并刷新任务弹窗与红点。
//
// 设计原则：
// - 业务文件只需 import 一个 recordTaskEvent
// - 新手任务的"逐个解锁"语义在 recordOnboardingProgress 内部已保证（未解锁时直接忽略）

import {
  recordDailyProgress, recordOnboardingProgress, commit
} from './state.js';
import { refreshActiveTaskTab, updateTaskRedDot, updateLineTabsRedDot } from './ui-tasks.js';
import { trackAppOpen } from './analytics.js';

// 事件名 → { daily?: taskId, onboarding?: taskId }
// 业务方调用时只需传事件名，本表负责映射
const EVENT_MAP = {
  // 抽签
  draw_once:    { onboarding: 'ob_draw1', daily: 'daily_lottery' },  // 抽一次签（含每日"完成1次抽奖"）
  draw_ten:     { onboarding: 'ob_draw10', daily: 'daily_lottery' }, // 抽十次签（也算1次抽奖完成）
  // 转盘
  spin_once:    { onboarding: 'ob_spin1',  daily: 'daily_invest' },   // 转一次（含每日"投币1次"）
  spin_ten:     { onboarding: 'ob_spin10' },     // 转十次
  // 道具
  synth_fragment: { onboarding: 'ob_synth' },    // 合成币胚
  use_talisman:  { onboarding: 'ob_use_talis' }, // 使用一张符箓
  // 观象
  view_coin:     { onboarding: 'ob_view_coin' }, // 在荷包点击硬币查看卦象
  view_hexagram: { onboarding: 'ob_view_hex' },   // 在收集册查看一次卦象
  // 定数
  add_task:      { onboarding: 'ob_add_task' },
  edit_task:     { onboarding: 'ob_edit_task' },
  add_milestone: { onboarding: 'ob_add_milestones' },     // +1 里程碑添加
  claim_milestone: { onboarding: 'ob_claim_milestone' }, // 开箱里程碑
  add_shop:      { onboarding: 'ob_add_shop' },           // +1 商品添加
  buy_shop:      { onboarding: 'ob_buy_shop' },
  del_shop:      { onboarding: 'ob_del_shop' },
  export_data:  { onboarding: 'ob_export' },
  // 归藏
  view_coin_count: { onboarding: 'ob_view_coin_count' },  // 查看荷包内硬币数量
  view_points_log: { onboarding: 'ob_view_points_log' },  // 查看贝筹流水
  // 童蒙
  view_help:     { onboarding: 'ob_view_help' }            // 查看使用说明
};

// 记录一次任务事件
// 返回 true 表示有任意任务刚好达成
export function recordTaskEvent(eventName, delta = 1) {
  const map = EVENT_MAP[eventName];
  if (!map) return false;
  let anyReached = false;
  let changed = false;

  if (map.daily) {
    const r = recordDailyProgress(map.daily, delta);
    if (r) anyReached = true;
    changed = true; // 即便没达成，进度也可能变了
  }
  if (map.onboarding) {
    const r = recordOnboardingProgress(map.onboarding, delta);
    if (r) anyReached = true;
    changed = true;
  }

  if (changed) {
    commit();
    refreshActiveTaskTab();
    updateTaskRedDot();
    updateLineTabsRedDot();
  }
  return anyReached;
}

// 应用启动时记录"打开页面"
export function recordPageOpen() {
  // 分析埋点：开新会话 + session_start + 当日去重 daily_active
  try { trackAppOpen(); } catch (e) { /* 分析层失败不影响主流程 */ }
  const r1 = recordDailyProgress('daily_open', 1);
  if (r1) commit();
  refreshActiveTaskTab();
  updateTaskRedDot();
  updateLineTabsRedDot();
}
