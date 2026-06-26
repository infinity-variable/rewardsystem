// ===== 每日任务跨日重置测试 =====
// _resetDailyTasksIfNewDay 未导出，通过 recordDailyProgress / hasClaimableTask 间接触发。
// 跨日时刻的边界条件最易出 bug（午夜抽签/领奖），本测试固化其重置语义。
// 运行: node test/test-daily-reset.js

import './lib.js'; // 必须首 import（注入 localStorage mock，供 state.js 加载）
import { getDefaultState, replaceState, getState, recordDailyProgress, hasClaimableTask, claimDailyTask } from '../state.js';
import { test, assert, summary, todayStr } from './lib.js';

function reset() { replaceState(getDefaultState()); }

console.log('===== 跨日重置：基础语义 =====');

// 用例1: 初始 dailyTaskState.date 为空，首次 recordDailyProgress 触发重置为今天
reset();
test('初始 date 为空串', getState().dailyTaskState.date, '');
const reached1 = recordDailyProgress('daily_open', 1);
test('daily_open +1 后刚好达成(target=1) → 返回 true', reached1, true);
test('重置后 date = 今天', getState().dailyTaskState.date, todayStr());
test('daily_open progress=1', getState().dailyTaskState.tasks.daily_open.progress, 1);
test('daily_open claimed=false', getState().dailyTaskState.tasks.daily_open.claimed, false);

// 用例2: 同日再次调用不重置，已有进度保留
reset();
recordDailyProgress('daily_open', 1);     // date 设为今天，daily_open.progress=1
recordDailyProgress('daily_lottery', 1);  // 同日，新增 daily_lottery
test('同日第二次调用 date 不变', getState().dailyTaskState.date, todayStr());
test('同日 daily_open 进度保留=1', getState().dailyTaskState.tasks.daily_open.progress, 1);
test('同日新增 daily_lottery progress=1', getState().dailyTaskState.tasks.daily_lottery.progress, 1);

console.log('\n===== 跨日重置：清空脏数据 =====');

// 用例3: 模拟昨天的已领奖任务，跨日调用 hasClaimableTask 应触发重置，清空 tasks
reset();
getState().dailyTaskState = {
  date: '2020-01-01',
  tasks: { daily_open: { progress: 1, claimed: true } }
};
const has3 = hasClaimableTask(); // 内部触发 _resetDailyTasksIfNewDay
test('跨日后无可领取任务 → hasClaimableTask=false', has3, false);
test('跨日后 date 更新为今天', getState().dailyTaskState.date, todayStr());
test('跨日后 tasks 被清空（旧 claimed 任务消失）', Object.keys(getState().dailyTaskState.tasks).length, 0);

// 用例4: 跨日后任务可重新完成与领取（昨日已领今日可再领）
reset();
getState().dailyTaskState = {
  date: '2020-01-01',
  tasks: { daily_open: { progress: 1, claimed: true } }
};
const reached4 = recordDailyProgress('daily_open', 1); // 触发重置 + 重新记录
test('跨日后 daily_open 可重新记录 → 返回 true', reached4, true);
test('跨日后 daily_open claimed 重置为 false', getState().dailyTaskState.tasks.daily_open.claimed, false);
test('跨日后 daily_open progress=1', getState().dailyTaskState.tasks.daily_open.progress, 1);
const label4 = claimDailyTask('daily_open');
assert('跨日后 daily_open 可重新领取（返回非空描述）', typeof label4 === 'string' && label4.length > 0);
test('领取后 claimed=true', getState().dailyTaskState.tasks.daily_open.claimed, true);

console.log('\n===== 同日：已领奖任务不再累计 =====');

// 用例5: 同日已 claimed 的任务，再次 recordDailyProgress 应被忽略
reset();
recordDailyProgress('daily_open', 1); // 达成
claimDailyTask('daily_open');         // 领取 → claimed=true
const reached5 = recordDailyProgress('daily_open', 1); // 再次记录
test('同日已领奖任务再记录 → 返回 false', reached5, false);
test('同日已领奖任务 progress 不变=1', getState().dailyTaskState.tasks.daily_open.progress, 1);
test('同日已领奖任务 claimed 仍 true', getState().dailyTaskState.tasks.daily_open.claimed, true);

console.log('\n===== 隔离性：每日重置不影响新手任务 =====');

// 用例6: onboardingTaskState 不受 _resetDailyTasksIfNewDay 影响
reset();
getState().dailyTaskState = { date: '2020-01-01', tasks: {} };
getState().onboardingTaskState = { ob_draw1: { progress: 1, claimed: false } };
hasClaimableTask(); // 触发每日重置
test('每日重置后 onboarding 数据保留 progress=1', getState().onboardingTaskState.ob_draw1.progress, 1);
test('每日重置后 onboarding claimed 保留=false', getState().onboardingTaskState.ob_draw1.claimed, false);

console.log('\n===== 进度上限：不超过 target =====');

// 用例7: 重复记录不会让 progress 超过 target（daily_lottery target=1）
reset();
recordDailyProgress('daily_lottery', 5);
test('progress 被 clamp 到 target=1', getState().dailyTaskState.tasks.daily_lottery.progress, 1);

summary();
