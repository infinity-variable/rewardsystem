// 测试八卦币优先级逻辑（纯逻辑测试，不依赖 state 模块）
// 运行方式: node test/test-coin-priority.js

import { CONFIG, getBaguaTypes } from '../config.js';

// 模拟 findSpinableCoinType 逻辑（转一次）
function findSpinableCoinType(unexchangedCoins) {
  const baguaTypes = getBaguaTypes();
  // 第一轮：纯八卦币 >= 3
  for (const t of baguaTypes) {
    if ((unexchangedCoins[t.id] || 0) >= CONFIG.SPIN_COIN_COST) return t.id;
  }
  // 第二轮：需要太极币补齐
  for (const t of baguaTypes) {
    const coinCount = unexchangedCoins[t.id] || 0;
    const taijiCount = unexchangedCoins['taiji'] || 0;
    if (coinCount + taijiCount >= CONFIG.SPIN_COIN_COST) return t.id;
  }
  return null;
}

// 模拟转十次选择逻辑（修复后）
function findTenSpinCoinType(unexchangedCoins) {
  const baguaTypes = getBaguaTypes();
  const taijiCount = unexchangedCoins['taiji'] || 0;
  let spinCoinType = null;
  // 第一轮：纯八卦币 >= 30
  for (const t of baguaTypes) {
    const coinCount = unexchangedCoins[t.id] || 0;
    if (coinCount >= CONFIG.TEN_SPIN_TOTAL_COINS) {
      spinCoinType = t.id;
      break;
    }
  }
  // 第二轮：需要太极币补齐
  if (!spinCoinType) {
    for (const t of baguaTypes) {
      const coinCount = unexchangedCoins[t.id] || 0;
      if (coinCount + taijiCount >= CONFIG.TEN_SPIN_TOTAL_COINS) {
        spinCoinType = t.id;
        break;
      }
    }
  }
  return spinCoinType;
}

let passCount = 0;
let failCount = 0;

function test(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passCount++;
    console.log(`✅ ${name}`);
  } else {
    failCount++;
    console.log(`❌ ${name}`);
    console.log(`   期望: ${JSON.stringify(expected)}`);
    console.log(`   实际: ${JSON.stringify(actual)}`);
  }
}

console.log('===== 转一次测试 =====');

// 测试1: 八卦币=5,太极币=10 → 应该选八卦币，不消耗太极币
{
  const coins = { 'qian': 5, 'taiji': 10 };
  const result = findSpinableCoinType(coins);
  const useTaiji = Math.max(0, CONFIG.SPIN_COIN_COST - (coins[result] || 0));
  test('八卦币=5,太极币=10 → 选qian,太极消耗=0', { type: result, useTaiji }, { type: 'qian', useTaiji: 0 });
}

// 测试2: 八卦币=3,太极币=10 → 不应该消耗太极币
{
  const coins = { 'qian': 3, 'taiji': 10 };
  const result = findSpinableCoinType(coins);
  const useTaiji = Math.max(0, CONFIG.SPIN_COIN_COST - (coins[result] || 0));
  test('八卦币=3,太极币=10 → 选qian,太极消耗=0', { type: result, useTaiji }, { type: 'qian', useTaiji: 0 });
}

// 测试3: 八卦币=2,太极币=5 → 应该消耗1太极币
{
  const coins = { 'qian': 2, 'taiji': 5 };
  const result = findSpinableCoinType(coins);
  const useTaiji = Math.max(0, CONFIG.SPIN_COIN_COST - (coins[result] || 0));
  test('八卦币=2,太极币=5 → 选qian,太极消耗=1', { type: result, useTaiji }, { type: 'qian', useTaiji: 1 });
}

// 测试4: 多种八卦币都>=3，选第一个
{
  const coins = { 'qian': 5, 'kun': 10, 'taiji': 10 };
  const result = findSpinableCoinType(coins);
  const useTaiji = Math.max(0, CONFIG.SPIN_COIN_COST - (coins[result] || 0));
  test('多种八卦币>=3 → 选第一个qian,太极消耗=0', { type: result, useTaiji }, { type: 'qian', useTaiji: 0 });
}

// 测试5: 没有八卦币>=3，但有八卦币=2+太极币=5
{
  const coins = { 'qian': 1, 'kun': 2, 'taiji': 5 };
  const result = findSpinableCoinType(coins);
  const useTaiji = Math.max(0, CONFIG.SPIN_COIN_COST - (coins[result] || 0));
  test('八卦币都<3 → 选第一个能凑够的,太极消耗=2', { type: result, useTaiji }, { type: 'qian', useTaiji: 2 });
}

console.log('\n===== 转十次测试 =====');

// 测试6: 八卦币=35,太极币=20 → 应该选八卦币，不消耗太极币
{
  const coins = { 'qian': 35, 'taiji': 20 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('八卦币=35,太极币=20 → 选qian,太极消耗=0', { type: result, useTaiji }, { type: 'qian', useTaiji: 0 });
}

// 测试7: 八卦币=30,太极币=10 → 不应该消耗太极币
{
  const coins = { 'qian': 30, 'taiji': 10 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('八卦币=30,太极币=10 → 选qian,太极消耗=0', { type: result, useTaiji }, { type: 'qian', useTaiji: 0 });
}

// 测试8: 八卦币=5,太极币=25 → 应该消耗25太极币
{
  const coins = { 'qian': 5, 'taiji': 25 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('八卦币=5,太极币=25 → 选qian,太极消耗=25', { type: result, useTaiji }, { type: 'qian', useTaiji: 25 });
}

// 测试9: 两种八卦币，一种>=30，一种<30但+太极币>=30 → 优先选>=30的
{
  const coins = { 'qian': 35, 'kun': 10, 'taiji': 20 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('qian=35,kun=10,太极=20 → 选qian,太极消耗=0', { type: result, useTaiji }, { type: 'qian', useTaiji: 0 });
}

// 测试10: 八卦币=20,太极币=15 → 应该消耗10太极币
{
  const coins = { 'qian': 20, 'taiji': 15 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('八卦币=20,太极币=15 → 选qian,太极消耗=10', { type: result, useTaiji }, { type: 'qian', useTaiji: 10 });
}

// 测试11: 关键场景 - 八卦币A=5,八卦币B=35,太极币=25 → 应该选B，不消耗太极币
{
  const coins = { 'qian': 5, 'kun': 35, 'taiji': 25 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('qian=5,kun=35,太极=25 → 选kun,太极消耗=0', { type: result, useTaiji }, { type: 'kun', useTaiji: 0 });
}

// 测试12: 关键场景 - 八卦币A=2,八卦币B=30,太极币=10 → 应该选B，不消耗太极币
{
  const coins = { 'qian': 2, 'kun': 30, 'taiji': 10 };
  const result = findTenSpinCoinType(coins);
  const useCoin = Math.min(coins[result] || 0, CONFIG.TEN_SPIN_TOTAL_COINS);
  const useTaiji = CONFIG.TEN_SPIN_TOTAL_COINS - useCoin;
  test('qian=2,kun=30,太极=10 → 选kun,太极消耗=0', { type: result, useTaiji }, { type: 'kun', useTaiji: 0 });
}

console.log(`\n===== 测试完成: ${passCount}通过, ${failCount}失败 =====`);
if (failCount > 0) {
  process.exit(1);
}
