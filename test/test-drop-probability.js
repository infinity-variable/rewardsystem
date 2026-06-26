// ===== 转盘掉落概率与衰减测试 =====
// 覆盖 getDropProb（纯函数）、recordDailySpin（跨日重置）、rollSpinDrops（随机掉落入库）。
// 概率对用户极度敏感，错了会被骂暗改；且衰减公式有"超出 20 次即触底"的隐蔽行为需固化。
// 运行: node test/test-drop-probability.js

import './lib.js'; // 必须首 import（注入 localStorage mock，供 state.js 加载）
import { getDefaultState, replaceState, getState, getDropProb, recordDailySpin, rollSpinDrops } from '../state.js';
import { CONFIG, TALISMANS } from '../config.js';
import { test, assert, approx, summary } from './lib.js';

const BASE = CONFIG.DROP_BASE_PROB;        // 0.33
const FREE = CONFIG.DROP_DAILY_FREE_COUNT; // 20
const DECAY = CONFIG.DROP_DECAY_FACTOR;    // 0.05
const MIN = CONFIG.DROP_MIN_PROB;          // 0.05

console.log('===== getDropProb：纯函数 =====');

// 用例1: 第 1 次维持基础概率
approx('spinCount=1 → 基础概率', getDropProb(1), BASE);
// 用例2: 第 20 次仍为基础（边界 <=）
approx('spinCount=20 → 仍为基础概率(边界<=)', getDropProb(20), BASE);
// 用例3: 第 21 次 —— 开始渐进衰减，0.33*0.85=0.2805，仍高于下限 0.05，不 clamp
approx('spinCount=21 → 渐进衰减（不 clamp）', getDropProb(21), BASE * Math.pow(DECAY, 21 - FREE));
// 用例4: 第 22 次继续衰减，0.33*0.85²≈0.2384，仍高于下限
approx('spinCount=22 → 继续渐进衰减', getDropProb(22), BASE * Math.pow(DECAY, 22 - FREE));
// 用例4b: 验证 clamp 临界点 —— 第 31 次仍高于 MIN(≈0.0552)，第 32 次跌破 MIN(≈0.0469) 开始 clamp
approx('spinCount=31 → 仍高于 MIN，不 clamp', getDropProb(31), BASE * Math.pow(DECAY, 31 - FREE));
approx('spinCount=32 → 跌破 MIN，clamp 到 MIN', getDropProb(32), MIN);
// 用例5: 极大次数 clamp 到下限
approx('spinCount=1000 → clamp 到 MIN', getDropProb(1000), MIN);
// 用例6: 0 次也属免费区间
approx('spinCount=0 → 基础概率', getDropProb(0), BASE);

// 参考信息：打印衰减曲线上几个关键点的原始值，便于将来调整 DECAY/MIN 时发现回归
{
  console.log('   [参考] 衰减曲线（无 clamp 时的原始值）:');
  [21, 22, 25, 30, 31, 32].forEach(n => {
    const raw = BASE * Math.pow(DECAY, n - FREE);
    const clamped = raw < MIN;
    console.log(`     spinCount=${n} → ${raw.toFixed(4)}${clamped ? `（低于 MIN=${MIN}，实际 clamp）` : ''}`);
  });
}

console.log('\n===== recordDailySpin：跨日重置 =====');

// 用例7: 首次调用，date 从 '' 变为今天，spinCount=1
replaceState(getDefaultState());
test('初始 dailyDropStats.date 为空串', getState().dailyDropStats.date, '');
const c7 = recordDailySpin();
test('首次调用返回 1', c7, 1);
assert('调用后 date 已更新且 spinCount=1',
  getState().dailyDropStats.date !== '' && getState().dailyDropStats.spinCount === 1);

// 用例8: 同日再次调用 spinCount 递增，date 不变
const c8 = recordDailySpin();
test('同日第二次返回 2', c8, 2);
test('同日 spinCount=2', getState().dailyDropStats.spinCount, 2);

// 用例9: 跨日 —— 模拟昨天的脏数据，调用后应重置为今天且 spinCount=1
getState().dailyDropStats = { date: '2020-01-01', spinCount: 50 };
const c9 = recordDailySpin();
test('跨日调用返回 1（重置后）', c9, 1);
test('跨日后 spinCount=1', getState().dailyDropStats.spinCount, 1);
assert('跨日后 date 已更新（不再是 2020-01-01）', getState().dailyDropStats.date !== '2020-01-01');

console.log('\n===== rollSpinDrops：随机掉落入库 =====');

const origRandom = Math.random;
let mockSeq;
Math.random = () => mockSeq.shift();

try {
  // 用例10: 两次随机都=0.999（>=0.33）→ 无掉落
  replaceState(getDefaultState());
  mockSeq = [0.999, 0.999];
  const r10 = rollSpinDrops();
  test('两次随机都未命中 → talisman=null', r10.talisman, null);
  test('两次随机都未命中 → fragment=false', r10.fragment, false);
  test('未命中 → talismans 总和=0', Object.values(getState().talismans).reduce((s, v) => s + v, 0), 0);
  test('未命中 → fragments=0', getState().fragments, 0);

  // 用例11: 命中 talisman 且命中 fragment
  // 注意 talisman 命中路径消耗 2 个随机数：判定 + 索引选择（fragment 判定再 1 个，共 3 个）
  // 序列: [判定0.0<0.33✓, 索引0.0→TALISMANS[0], fragment判定0.0<0.33✓]
  replaceState(getDefaultState());
  mockSeq = [0.0, 0.0, 0.0];
  const r11 = rollSpinDrops();
  test('命中 talisman → id=TALISMANS[0]', r11.talisman, TALISMANS[0].id);
  test('命中 fragment=true', r11.fragment, true);
  test('talisman 已入库 +1', getState().talismans[TALISMANS[0].id], 1);
  test('fragment 已入库 +1', getState().fragments, 1);

  // 用例12: 只命中 talisman 不命中 fragment
  // 序列: [判定✓, 索引0.0, fragment判定0.999>=0.33✗]（共 3 个随机数）
  replaceState(getDefaultState());
  mockSeq = [0.0, 0.0, 0.999];
  const r12 = rollSpinDrops();
  assert('仅 talisman 命中', r12.talisman !== null && r12.fragment === false);

  // 用例13: 只命中 fragment 不命中 talisman
  replaceState(getDefaultState());
  mockSeq = [0.999, 0.0];
  const r13 = rollSpinDrops();
  assert('仅 fragment 命中', r13.talisman === null && r13.fragment === true);

  // 用例14: result.prob 与 getDropProb(当前次数) 一致
  // rollSpinDrops 内部先 recordDailySpin 推进次数，prob 取推进后的次数
  replaceState(getDefaultState());
  mockSeq = [0.999, 0.999];
  const r14 = rollSpinDrops();
  approx('result.prob 与 getDropProb(1) 一致', r14.prob, getDropProb(1));

  // 用例15: 【副作用陷阱】rollSpinDrops 内部会推进 spinCount；
  // 若调用方又单独调 recordDailySpin，同一次转盘会被计数两次，加速衰减。
  // 此测试固化该行为，提醒调用方勿重复调用 recordDailySpin。
  replaceState(getDefaultState());
  recordDailySpin();            // 调用方误调一次 → count=1
  mockSeq = [0.999, 0.999];
  rollSpinDrops();              // 内部再 recordDailySpin → count=2
  test('副作用：外部+内部各计一次 → spinCount=2', getState().dailyDropStats.spinCount, 2);
} finally {
  // 恢复 Math.random，避免污染其它测试
  Math.random = origRandom;
}

summary();
