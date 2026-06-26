// ===== 测试公共库 =====
// 作用：
// 1) 在 Node 环境注入 localStorage mock —— state.js 模块加载时即调用 loadState()，
//    该函数依赖 localStorage，不 mock 会直接抛 ReferenceError。
// 2) 提供 test / assert / approx 断言与汇总，避免每个测试文件重复模板。
// 3) todayStr() 与 state.js 内部 _todayStr() 算法一致，供跨日测试对照。
//
// 重要：使用本库的测试文件必须把 `import './lib.js'` 放在所有其它 import 之前，
// 确保 polyfill 在 state.js 加载前生效（ES 模块按 import 顺序深度优先求值）。

if (typeof globalThis.localStorage === 'undefined') {
  const _store = {};
  globalThis.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
    setItem(k, v) { _store[k] = String(v); },
    removeItem(k) { delete _store[k]; },
    clear() { for (const k of Object.keys(_store)) delete _store[k]; }
  };
}

let _pass = 0;
let _fail = 0;

// 深度相等断言（基于 JSON 序列化比较，适合纯数据结构）
export function test(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    _pass++;
    console.log(`✅ ${name}`);
  } else {
    _fail++;
    console.log(`❌ ${name}`);
    console.log(`   期望: ${JSON.stringify(expected)}`);
    console.log(`   实际: ${JSON.stringify(actual)}`);
  }
}

// 布尔断言
export function assert(name, cond) {
  if (cond) {
    _pass++;
    console.log(`✅ ${name}`);
  } else {
    _fail++;
    console.log(`❌ ${name}`);
  }
}

// 浮点近似相等断言（概率计算专用）
export function approx(name, actual, expected, eps = 1e-9) {
  const pass = Math.abs(actual - expected) <= eps;
  if (pass) {
    _pass++;
    console.log(`✅ ${name}`);
  } else {
    _fail++;
    console.log(`❌ ${name}`);
    console.log(`   期望: ${expected}`);
    console.log(`   实际: ${actual}`);
  }
}

// 汇总并按需以非零码退出（便于 CI 识别失败）
export function summary() {
  console.log(`\n===== 完成: ${_pass}通过, ${_fail}失败 =====`);
  if (_fail > 0) process.exit(1);
}

// 计算今天的日期字符串（YYYY-MM-DD，本地时区），与 state.js _todayStr 一致
export function todayStr() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
}
