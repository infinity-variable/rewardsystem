// ===== 「时来运转」符箓逻辑测试 =====
// useTalismanYun 是不可逆的硬币转移操作（最少→最多），出错会直接导致用户资产异常，
// 是全项目风险最高的函数之一。本测试覆盖其边界与确定性陷阱。
// 运行: node test/test-talisman-yun.js

import './lib.js'; // 必须首 import（注入 localStorage mock，供 state.js 加载）
import { getDefaultState, replaceState, getState, useTalismanYun } from '../state.js';
import { test, assert, summary } from './lib.js';

// 每个用例前重置状态，避免相互污染
function reset() {
  replaceState(getDefaultState());
}

console.log('===== 时来运转：边界场景 =====');

// 用例1: 全部八卦币为 0 → 应返回 null（无可转化硬币）
reset();
test('全部八卦币为 0 → null', useTalismanYun(), null);

// 用例2: 仅 1 种八卦币有数量 → withCount.length<2，应返回 null
reset();
getState().unexchangedCoins.qian = 5;
test('仅 qian=5 一种币 → null', useTalismanYun(), null);

// 用例3: 太极币不参与转化（getBaguaTypes 已排除 taiji）
// 设 taiji=100 但仅 qian 一种八卦币，仍应返回 null
reset();
getState().unexchangedCoins.taiji = 100;
getState().unexchangedCoins.qian = 5;
test('太极币不参与，仅 qian=5 → null', useTalismanYun(), null);

console.log('\n===== 时来运转：常规转化 =====');

// 用例4: qian=5, kun=10 → from=qian, to=kun, moved=5；qian 归零，kun=15
reset();
const st4 = getState();
st4.unexchangedCoins.qian = 5;
st4.unexchangedCoins.kun = 10;
const r4 = useTalismanYun();
test('qian=5,kun=10 → from=qian,to=kun,moved=5',
  { from: r4.from.id, to: r4.to.id, moved: r4.moved },
  { from: 'qian', to: 'kun', moved: 5 });
test('转化后 qian=0', getState().unexchangedCoins.qian, 0);
test('转化后 kun=15', getState().unexchangedCoins.kun, 15);

// 用例5: 3 种币 qian=2, kan=10, zhen=5 → from=qian(最少), to=kan(最多), moved=2
reset();
const st5 = getState();
st5.unexchangedCoins.qian = 2;
st5.unexchangedCoins.kan = 10;
st5.unexchangedCoins.zhen = 5;
const r5 = useTalismanYun();
test('qian=2,kan=10,zhen=5 → from=qian,to=kan,moved=2',
  { from: r5.from.id, to: r5.to.id, moved: r5.moved },
  { from: 'qian', to: 'kan', moved: 2 });
test('转化后 qian=0', getState().unexchangedCoins.qian, 0);
test('转化后 kan=12', getState().unexchangedCoins.kan, 12);
test('zhen 不变=5', getState().unexchangedCoins.zhen, 5);

console.log('\n===== 时来运转：并列歧义（确定性陷阱）=====');
// getBaguaTypes 顺序: qian,kan,gen,zhen,xun,li,kun,dui
// Array.prototype.sort 在 Node 中稳定，并列时保持原顺序。

// 用例6: 最少并列 qian=2, kan=2, zhen=10 → from 取首个=qian，to=唯一最大=zhen
reset();
const st6 = getState();
st6.unexchangedCoins.qian = 2;
st6.unexchangedCoins.kan = 2;
st6.unexchangedCoins.zhen = 10;
const r6 = useTalismanYun();
test('最少并列(qian=2,kan=2,zhen=10) → from=qian(稳定排序取首个)', r6.from.id, 'qian');
test('最少并列 → to=zhen(唯一最大)', r6.to.id, 'zhen');
test('最少并列 → moved=2', r6.moved, 2);

// 用例7: 最多并列 qian=2, kan=10, gen=10 → 排序后 [qian(2),kan(10),gen(10)]，to 取末个=gen
reset();
const st7 = getState();
st7.unexchangedCoins.qian = 2;
st7.unexchangedCoins.kan = 10;
st7.unexchangedCoins.gen = 10;
const r7 = useTalismanYun();
test('最多并列(qian=2,kan=10,gen=10) → from=qian', r7.from.id, 'qian');
test('最多并列 → to=gen(稳定排序取末个)', r7.to.id, 'gen');
test('最多并列 → moved=2', r7.moved, 2);

console.log('\n===== 时来运转：上限 clamp =====');

// 用例8: 目标币接近上限，转化后 clamp 至 COIN_MAX_COUNT(10000)
// qian=9999, zhen=5 → from=zhen, to=qian, moved=5；9999+5=10004 → clamp 10000
reset();
const st8 = getState();
st8.unexchangedCoins.qian = 9999;
st8.unexchangedCoins.zhen = 5;
const r8 = useTalismanYun();
test('qian=9999,zhen=5 → from=zhen,to=qian', { from: r8.from.id, to: r8.to.id }, { from: 'zhen', to: 'qian' });
test('转化后 qian clamp 到 10000', getState().unexchangedCoins.qian, 10000);
test('转化后 zhen=0', getState().unexchangedCoins.zhen, 0);

console.log('\n===== 时来运转：返回值结构与等量场景 =====');

// 用例9: 返回的 from/to 是 trigram 对象，含 id 与 name
reset();
getState().unexchangedCoins.qian = 3;
getState().unexchangedCoins.kun = 8;
const r9 = useTalismanYun();
assert('from 含 name 字段', typeof r9.from.name === 'string' && r9.from.name.length > 0);
assert('to 含 name 字段', typeof r9.to.name === 'string' && r9.to.name.length > 0);

// 用例10: 等量两种币 qian=5, kun=5 → 仍可转化（from=qian,to=kun）
reset();
getState().unexchangedCoins.qian = 5;
getState().unexchangedCoins.kun = 5;
const r10 = useTalismanYun();
test('等量 qian=5,kun=5 → from=qian,to=kun,moved=5',
  { from: r10.from.id, to: r10.to.id, moved: r10.moved },
  { from: 'qian', to: 'kun', moved: 5 });
test('等量转化后 qian=0', getState().unexchangedCoins.qian, 0);
test('等量转化后 kun=10', getState().unexchangedCoins.kun, 10);

summary();
