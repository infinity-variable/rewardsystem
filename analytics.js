// ===== 产品分析埋点层 =====
// 与 tasks-tracker.js（任务驱动埋点）平行存在，互不依赖。
// 目的：回答"功能是否有效"——DAU、留存、漏斗转化、复购。
// 设计：
// - 独立 localStorage key（ANALYTICS_KEY），不污染主 state，不触发 UI 刷新
// - 环形缓冲（默认 2000 条），避免无限膨胀
// - 提供 sessionId / userId（本地匿名，无后端依赖）
// - 指标计算函数供看板调用，导出 CSV 便于面试演示

const ANALYTICS_KEY = 'reward_analytics_log_v1';
const USER_ID_KEY = 'reward_analytics_uid';
const SESSION_ID_KEY = 'reward_analytics_sid';
const MAX_EVENTS = 2000;

import { $ } from './dom.js';

// ---- 会话 / 用户标识 ----
function _getOrCreateUserId() {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

function _newSessionId() {
  const sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  sessionStorage.setItem(SESSION_ID_KEY, sid);
  return sid;
}

function _getSessionId() {
  let sid = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sid) sid = _newSessionId();
  return sid;
}

function _todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ---- 持久化 ----
function _loadLog() {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _saveLog(events) {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  } catch {
    // 配额超限：截断一半再试
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-Math.floor(MAX_EVENTS / 2))));
    } catch { /* 静默失败，分析数据不影响主流程 */ }
  }
}

// ---- 核心 API ----
// 通用埋点入口。props 任意结构，建议字段命名 snake_case。
export function track(event, props = {}) {
  const ev = {
    event,
    ts: Date.now(),
    day: _todayStr(),
    userId: _getOrCreateUserId(),
    sessionId: _getSessionId(),
    props
  };
  const log = _loadLog();
  log.push(ev);
  if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
  _saveLog(log);
}

// 应用启动：开新会话 + 记 app_open + 当日去重的 daily_active
export function trackAppOpen() {
  _newSessionId();
  track('session_start');
  const log = _loadLog();
  const today = _todayStr();
  const hasDAU = log.some(e => e.event === 'daily_active' && e.day === today);
  if (!hasDAU) track('daily_active');
}

// 读取原始事件（看板 / 导出用）
export function getAnalyticsLog() {
  return _loadLog();
}

// 清空（用于"清零"联动，避免历史分析数据污染）
export function clearAnalyticsLog() {
  _saveLog([]);
}

// ---- 指标计算 ----
// 北极星：周活跃用户平均抽签次数（单机=本人，仅演示算法）
// 返回 { dau, nextDayRetention, d7Retention, drawToWheelRate, wheelToShopRate,
//        shopRepeatRate, talismanUseRate, drawCount, wheelCount, shopCount, ... }

export function computeMetrics() {
  const log = _loadLog();
  const total = log.length;

  // DAU：去重 day 上的 daily_active 事件
  const dauDays = new Set(log.filter(e => e.event === 'daily_active').map(e => e.day));
  const dau = dauDays.size;

  // 次日 / 7 日留存：取首日 active day，检查之后 1 / 7 天是否有 active
  const sortedDays = [...dauDays].sort();
  let nextDayRetention = null;
  let d7Retention = null;
  if (sortedDays.length > 0) {
    const first = new Date(sortedDays[0] + 'T00:00:00');
    const nextDay = _todayStr(new Date(first.getTime() + 86400000));
    const d7Day = _todayStr(new Date(first.getTime() + 7 * 86400000));
    if (log.some(e => e.event === 'daily_active' && e.day === nextDay)) nextDayRetention = 1;
    else if (new Date(_todayStr()) > new Date(nextDay + 'T00:00:00')) nextDayRetention = 0;
    if (log.some(e => e.event === 'daily_active' && e.day === d7Day)) d7Retention = 1;
    else if (new Date(_todayStr()) > new Date(d7Day + 'T00:00:00')) d7Retention = 0;
  }

  // 漏斗事件计数
  const drawEvents = log.filter(e => e.event === 'lottery_draw');
  const wheelEvents = log.filter(e => e.event === 'wheel_spin');
  const shopEvents = log.filter(e => e.event === 'shop_redeem');
  const talismanUseEvents = log.filter(e => e.event === 'talisman_use');
  const talismanGainEvents = log.filter(e => e.event === 'talisman_gain');

  const drawCount = drawEvents.length;
  const wheelCount = wheelEvents.length;
  const shopCount = shopEvents.length;

  // 转化率：基于"是否发生过该行为的用户"——单机下用户=自己，用计数近似
  const drawToWheelRate = drawCount > 0 ? wheelCount / drawCount : null;
  const wheelToShopRate = wheelCount > 0 ? shopCount / wheelCount : null;

  // 复购：7 天内 ≥2 次兑换 / 兑换过一次
  const recent = Date.now() - 7 * 86400000;
  const recentShop = shopEvents.filter(e => e.ts >= recent);
  const shopRepeatRate = shopCount > 0 ? (recentShop.length >= 2 ? 1 : 0) : null;

  // 符箓使用率
  const talismanUseRate = talismanGainEvents.length > 0
    ? talismanUseEvents.length / talismanGainEvents.length
    : null;

  // 诸事皆宜翻倍抽签占比（验证符箓效果是否被消费）
  const bonusDraws = drawEvents.filter(e => e.props && e.props.bonus).length;
  const bonusDrawRate = drawCount > 0 ? bonusDraws / drawCount : null;

  // 新手漏斗：按 onboarding_step 顺序看完成数
  const obSteps = log.filter(e => e.event === 'onboarding_step');
  const obStepCounts = {};
  obSteps.forEach(e => {
    const k = (e.props && e.props.step) || 'unknown';
    obStepCounts[k] = (obStepCounts[k] || 0) + 1;
  });

  return {
    totalEvents: total,
    activeDays: dau,
    dau,
    nextDayRetention,
    d7Retention,
    drawCount,
    wheelCount,
    shopCount,
    talismanUseCount: talismanUseEvents.length,
    talismanGainCount: talismanGainEvents.length,
    drawToWheelRate,
    wheelToShopRate,
    shopRepeatRate,
    talismanUseRate,
    bonusDrawRate,
    onboardingStepCounts: obStepCounts,
    firstActiveDay: sortedDays[0] || null,
    lastActiveDay: sortedDays[sortedDays.length - 1] || null
  };
}

// ---- 导出 CSV ----
export function exportAnalyticsCSV() {
  const log = _loadLog();
  const header = ['event', 'ts', 'day', 'userId', 'sessionId', 'props_json'];
  const lines = [header.join(',')];
  log.forEach(e => {
    const row = [
      e.event,
      e.ts,
      e.day,
      e.userId,
      e.sessionId,
      '"' + JSON.stringify(e.props || {}).replace(/"/g, '""') + '"'
    ];
    lines.push(row.join(','));
  });
  return lines.join('\n');
}

// ---- 看板渲染 ----
// 将指标渲染到指定容器（HTMLElement），用于隐藏的数据分析弹窗
export function renderAnalyticsDashboard(container) {
  const m = computeMetrics();
  const pct = v => (v === null || v === undefined) ? '—' : (v * 100).toFixed(0) + '%';
  const num = v => (v === null || v === undefined) ? '—' : v;

  const obRows = Object.entries(m.onboardingStepCounts)
    .map(([step, cnt]) => `<tr><td>${step}</td><td>${cnt}</td></tr>`).join('') || '<tr><td colspan="2">暂无数据</td></tr>';

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="analytics-card">
        <h4>活跃与留存</h4>
        <p>累计活跃天数：<b>${num(m.activeDays)}</b></p>
        <p>次日留存：<b>${pct(m.nextDayRetention)}</b></p>
        <p>7日留存：<b>${pct(m.d7Retention)}</b></p>
        <p class="hint">首日：${m.firstActiveDay || '—'}　末日：${m.lastActiveDay || '—'}</p>
      </div>
      <div class="analytics-card">
        <h4>核心漏斗</h4>
        <p>抽签次数：<b>${num(m.drawCount)}</b></p>
        <p>转盘次数：<b>${num(m.wheelCount)}</b></p>
        <p>商城兑换：<b>${num(m.shopCount)}</b></p>
        <p>抽签→转盘：<b>${pct(m.drawToWheelRate)}</b></p>
        <p>转盘→商城：<b>${pct(m.wheelToShopRate)}</b></p>
      </div>
      <div class="analytics-card">
        <h4>道具健康度</h4>
        <p>符箓获得：<b>${num(m.talismanGainCount)}</b>　使用：<b>${num(m.talismanUseCount)}</b></p>
        <p>符箓使用率：<b>${pct(m.talismanUseRate)}</b></p>
        <p>诸事皆宜翻倍占比：<b>${pct(m.bonusDrawRate)}</b></p>
        <p>商城7日复购：<b>${pct(m.shopRepeatRate)}</b></p>
      </div>
      <div class="analytics-card">
        <h4>新手漏斗</h4>
        <table class="analytics-table">
          <thead><tr><th>步骤</th><th>完成数</th></tr></thead>
          <tbody>${obRows}</tbody>
        </table>
        <p class="hint">总事件数：${m.totalEvents}　(环形缓冲上限 2000)</p>
      </div>
    </div>
  `;
}

// ---- 看板弹窗控制（供 ui.js re-export，events.js 绑定） ----
export function openAnalyticsDashboard() {
  const container = $('analytics-content');
  if (container) renderAnalyticsDashboard(container);
  const modal = $('analytics-modal');
  if (modal) modal.classList.add('active');
}

export function closeAnalyticsDashboard() {
  const modal = $('analytics-modal');
  if (modal) modal.classList.remove('active');
}

// 导出原始事件 CSV（用于面试演示 / 离线分析）
export function exportAnalyticsFile() {
  const csv = exportAnalyticsCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  a.download = `analytics-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
