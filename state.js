// ===== 数据模型与持久化 =====
// state 为模块内私有，外部通过 getState() 读取、commit()/replaceState() 变更，
// 通过 subscribe() 注册监听器，在状态变更时自动触发 UI 刷新。

import { CONFIG, TRIGRAMS, getBaguaTypes, TALISMANS, DAILY_TASKS, ONBOARDING_LINES, ONBOARDING_TASK_IDS, COLLECTION_CHESTS } from './config.js';
import { DEFAULT_MILESTONES, DEFAULT_SHOP_ITEMS, DEFAULT_TASKS } from './defaultSettings.js';

const STORAGE_KEY = CONFIG.STORAGE_KEY;

export function getDefaultState() {
  const coins = {};
  TRIGRAMS.forEach(t => coins[t.id] = 0);
  const talismans = {};
  TALISMANS.forEach(t => talismans[t.id] = 0);
  // 深拷贝默认设置，避免修改常量
  const tasks = DEFAULT_TASKS.map(t => ({ ...t }));
  const milestones = DEFAULT_MILESTONES.map(m => ({ ...m }));
  const shopItems = DEFAULT_SHOP_ITEMS.map(i => ({ ...i }));
  return {
    unexchangedCoins: coins,
    jar: { type: null, count: 0, usedTaiji: 0 },
    points: 0,
    totalInvested: 0,
    settings: { taskName: tasks[0].name, taskBaseCount: tasks[0].count },
    tasks,
    milestones,
    shopItems,
    shopHistory: [],                          // 已兑换的「只能换一次」商品归档
    claimedMilestones: [],
    pointLogs: [],
    coinLogs: [],
    drawnHexagrams: [],
    achievements: [],
    // ===== 道具系统 =====
    fragments: 0,                            // 币胚数量
    talismans,                               // 各符箓持有数 { id: count }
    talismanEffects: { doubleDraw: false },  // 激活中的符箓效果
    dailyDropStats: { date: '', spinCount: 0 }, // 每日转盘次数（用于掉落衰减）
    // ===== 收集册宝箱 =====
    collectionChestClaimed: [],                 // 已领取的收集册宝箱索引
    newHexagrams: [],                           // 新解锁未领取币胚的卦编号
    // ===== 任务系统 =====
    // 每日签到：{ date: 'YYYY-MM-DD', tasks: { [id]: { progress, claimed } }, randomPick: { [id]: optionIndex } }
    dailyTaskState: { date: '', tasks: {} },
    // 新手任务：{ [taskId]: { progress, claimed } }，未出现在对象中视为未开始
    onboardingTaskState: {},
    // 成就奖励：{ [achId]: { reward: {type,id?,amount}, claimed: bool } }
    achievementRewards: {},
    lastExportTime: 0,            // 上次导出数据的时间戳（ms）
    stats: {
      trigramDrawCount: {},
      totalCoinsEarned: 0,
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      totalShopItemsAdded: 0,
      drawDays: []                // 累计抽签天数（去重日期数组 YYYY-MM-DD），用于"持之以恒"成就
    }
  };
}

// 返回完全清空的空状态（清零时使用，不包含默认设置）
export function getEmptyState() {
  const def = getDefaultState();
  return {
    ...def,
    milestones: [],
    shopItems: [],
  };
}

// 字段迁移与补全：loadState 与导入数据共用此逻辑，避免重复
export function migrateState(parsed) {
  const def = getDefaultState();
  if (!parsed.unexchangedCoins) parsed.unexchangedCoins = def.unexchangedCoins;
  if (!parsed.jar) parsed.jar = def.jar;
  if (typeof parsed.points !== 'number') parsed.points = 0;
  if (typeof parsed.totalInvested !== 'number') parsed.totalInvested = 0;
  if (!parsed.settings) parsed.settings = { ...def.settings };
  if (!parsed.settings.taskName) parsed.settings.taskName = def.settings.taskName;
  if (typeof parsed.settings.taskBaseCount !== 'number') parsed.settings.taskBaseCount = def.settings.taskBaseCount;
  if (!Array.isArray(parsed.tasks)) {
    // 从旧版 settings 迁移
    parsed.tasks = [{ name: parsed.settings.taskName || def.settings.taskName, count: parsed.settings.taskBaseCount || def.settings.taskBaseCount, unit: DEFAULT_TASKS[0].unit }];
  }
  parsed.tasks.forEach(t => { if (!t.unit) t.unit = '个'; });
  if (!Array.isArray(parsed.milestones)) parsed.milestones = [];
  // 里程碑达成状态以 totalInvested 为准重新计算（修复旧版本默认 achieved:true 的问题）
  // 已领取的保持已达成，未达成但被错误标记为 true 的重置为 false
  parsed.milestones.forEach((m, i) => {
    if (!m) return;
    const reached = (typeof parsed.totalInvested === 'number' && m.count > 0 && parsed.totalInvested >= m.count);
    const claimed = Array.isArray(parsed.claimedMilestones) && parsed.claimedMilestones.includes(i);
    m.achieved = reached || claimed;
  });
  if (!Array.isArray(parsed.shopItems)) parsed.shopItems = [];
  // 旧商品补全 limit 字段（默认无限次）
  parsed.shopItems.forEach(it => {
    if (it.limit !== 'once' && it.limit !== 'unlimited') it.limit = 'unlimited';
  });
  if (!Array.isArray(parsed.shopHistory)) parsed.shopHistory = [];
  parsed.shopHistory.forEach(it => {
    if (!it || typeof it !== 'object') return;
    if (it.limit !== 'once' && it.limit !== 'unlimited') it.limit = 'once';
  });
  if (!Array.isArray(parsed.claimedMilestones)) parsed.claimedMilestones = [];
  if (!Array.isArray(parsed.pointLogs)) parsed.pointLogs = [];
  if (!Array.isArray(parsed.coinLogs)) parsed.coinLogs = [];
  if (!Array.isArray(parsed.drawnHexagrams)) parsed.drawnHexagrams = [];
  if (!Array.isArray(parsed.collectionChestClaimed)) parsed.collectionChestClaimed = [];
  if (!Array.isArray(parsed.newHexagrams)) parsed.newHexagrams = [];
  if (!Array.isArray(parsed.achievements)) parsed.achievements = [];
  if (!Array.isArray(parsed.newAchievements)) parsed.newAchievements = [];
  if (!parsed.achievementRewards || typeof parsed.achievementRewards !== 'object') parsed.achievementRewards = {};
  if (typeof parsed.lastExportTime !== 'number') parsed.lastExportTime = 0;
  // ===== 道具系统字段迁移 =====
  if (typeof parsed.fragments !== 'number') parsed.fragments = 0;
  if (!parsed.talismans || typeof parsed.talismans !== 'object') {
    parsed.talismans = {};
    TALISMANS.forEach(t => parsed.talismans[t.id] = 0);
  } else {
    TALISMANS.forEach(t => {
      if (typeof parsed.talismans[t.id] !== 'number') parsed.talismans[t.id] = 0;
    });
  }
  if (!parsed.talismanEffects || typeof parsed.talismanEffects !== 'object') {
    parsed.talismanEffects = { doubleDraw: false };
  } else if (typeof parsed.talismanEffects.doubleDraw !== 'boolean') {
    parsed.talismanEffects.doubleDraw = false;
  }
  if (!parsed.dailyDropStats || typeof parsed.dailyDropStats !== 'object') {
    parsed.dailyDropStats = { date: '', spinCount: 0 };
  }
  // ===== 任务系统字段迁移 =====
  if (!parsed.dailyTaskState || typeof parsed.dailyTaskState !== 'object') {
    parsed.dailyTaskState = { date: '', tasks: {} };
  } else {
    if (typeof parsed.dailyTaskState.date !== 'string') parsed.dailyTaskState.date = '';
    if (!parsed.dailyTaskState.tasks || typeof parsed.dailyTaskState.tasks !== 'object') {
      parsed.dailyTaskState.tasks = {};
    }
  }
  if (!parsed.onboardingTaskState || typeof parsed.onboardingTaskState !== 'object') {
    parsed.onboardingTaskState = {};
  } else {
    // 规范化每个任务项：必须含 progress(有限数) 与 claimed(boolean)
    for (const id of Object.keys(parsed.onboardingTaskState)) {
      const t = parsed.onboardingTaskState[id];
      if (!t || typeof t !== 'object') {
        delete parsed.onboardingTaskState[id];
        continue;
      }
      if (typeof t.progress !== 'number' || Number.isNaN(t.progress)) t.progress = 0;
      if (typeof t.claimed !== 'boolean') t.claimed = false;
    }
  }
  // 同样规范化每日任务项
  if (parsed.dailyTaskState && parsed.dailyTaskState.tasks) {
    for (const id of Object.keys(parsed.dailyTaskState.tasks)) {
      const t = parsed.dailyTaskState.tasks[id];
      if (!t || typeof t !== 'object') {
        delete parsed.dailyTaskState.tasks[id];
        continue;
      }
      if (typeof t.progress !== 'number' || Number.isNaN(t.progress)) t.progress = 0;
      if (typeof t.claimed !== 'boolean') t.claimed = false;
    }
  }
  // 确保 stats 存在
  if (!parsed.stats) parsed.stats = def.stats;
  if (!parsed.stats.trigramDrawCount) parsed.stats.trigramDrawCount = {};
  if (typeof parsed.stats.totalCoinsEarned !== 'number') parsed.stats.totalCoinsEarned = 0;
  if (typeof parsed.stats.totalPointsEarned !== 'number') parsed.stats.totalPointsEarned = 0;
  if (typeof parsed.stats.totalPointsSpent !== 'number') parsed.stats.totalPointsSpent = 0;
  if (typeof parsed.stats.totalShopItemsAdded !== 'number') parsed.stats.totalShopItemsAdded = 0;
  if (!Array.isArray(parsed.stats.drawDays)) parsed.stats.drawDays = [];
  // 确保所有八卦类型存在
  TRIGRAMS.forEach(t => {
    if (typeof parsed.unexchangedCoins[t.id] !== 'number') parsed.unexchangedCoins[t.id] = 0;
  });
  return parsed;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return migrateState(JSON.parse(saved));
    }
  } catch (e) {
    // 解析失败时记录警告并回退到默认状态，避免静默吞错
    console.warn('[state] 读取本地数据失败，使用默认状态:', e);
  }
  return getDefaultState();
}

// ===== 私有 state + 订阅 =====
let _state = loadState();
const _subscribers = new Set();

// 读取状态（返回内部对象引用，可直接读取字段；写入请通过 commit/replaceState 触发通知）
export function getState() { return _state; }

// 持久化（不触发通知）
export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
}

// 持久化并通知所有订阅者（用于直接修改 _state 后刷新 UI）
export function commit() {
  saveState();
  _subscribers.forEach(fn => fn(_state));
}

// 整体替换状态（用于清零/导入），持久化并通知
export function replaceState(newState) {
  _state = newState;
  saveState();
  _subscribers.forEach(fn => fn(_state));
}

// 注册订阅者，状态变更时被调用。返回取消订阅函数。
export function subscribe(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

// ===== 状态查询助手 =====
export function getTotalUnexchanged() {
  return Object.values(_state.unexchangedCoins).reduce((s, v) => s + v, 0);
}

// 计算某种八卦币+太极币能否凑够3枚，返回实际可凑数量
export function getEffectiveCount(coinId) {
  const coinCount = _state.unexchangedCoins[coinId] || 0;
  const taijiCount = _state.unexchangedCoins['taiji'] || 0;
  return Math.min(CONFIG.SPIN_COIN_COST, coinCount + taijiCount);
}

// 找到可凑够3枚的八卦币类型（优先纯八卦币，其次需要太极币补）
export function findSpinableCoinType() {
  const baguaTypes = getBaguaTypes();
  for (const t of baguaTypes) {
    if (_state.unexchangedCoins[t.id] >= CONFIG.SPIN_COIN_COST) return t.id;
  }
  for (const t of baguaTypes) {
    if (getEffectiveCount(t.id) >= CONFIG.SPIN_COIN_COST) return t.id;
  }
  return null;
}

// 计算可转十次的最大次数（需同一种八卦币+太极币≥30才能转）
export function calcMaxTenSpins() {
  const taijiCount = _state.unexchangedCoins['taiji'] || 0;
  for (const t of getBaguaTypes()) {
    const coinCount = _state.unexchangedCoins[t.id] || 0;
    if (coinCount + taijiCount >= CONFIG.TEN_SPIN_TOTAL_COINS) {
      return CONFIG.TEN_SPIN_COUNT;
    }
  }
  return 0;
}

// ===== 流水记录 =====
function _nowDateStr() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + '\n' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}

// 贝筹流水记录
// 注意：仅写入内存数组，不触发持久化与通知。调用方需在完成所有状态变更后
// 调用 commit() 统一持久化并通知订阅者刷新 UI。
export function addPointLog(type, amount, desc) {
  _state.pointLogs.push({ date: _nowDateStr(), type, amount, desc, invested: _state.totalInvested });
  if (type === 'earn' && amount > 0) _state.stats.totalPointsEarned += amount;
  if (type === 'spend' && amount < 0) _state.stats.totalPointsSpent += Math.abs(amount);
}

// 铜币流水记录
// 同 addPointLog，不触发持久化与通知，由调用方 commit() 统一处理。
export function addCoinLog(type, amount, desc) {
  _state.coinLogs.push({ date: _nowDateStr(), type, amount, desc, invested: _state.totalInvested });
}

// ===== 里程碑 =====
// 检查里程碑达成情况，变更时持久化并通知订阅者（UI 由订阅者刷新）
export function checkMilestones() {
  let changed = false;
  _state.milestones.forEach(m => {
    if (!m.achieved && m.count > 0 && _state.totalInvested >= m.count) {
      m.achieved = true;
      changed = true;
      console.log(`[里程碑] 达成！累计=${_state.totalInvested}，目标=${m.count}，奖励=${m.reward}`);
    }
  });
  if (changed) commit();
}

// 领取里程碑奖励，返回领取到的里程碑对象（或 null）
export function claimMilestone(index) {
  const m = _state.milestones[index];
  if (!m || !m.achieved || _state.claimedMilestones.includes(index)) return null;
  _state.claimedMilestones.push(index);
  addPointLog('milestone', 0, `里程碑奖励：${m.reward}`);
  commit();
  console.log(`[里程碑] 领取奖励！目标=${m.count}，奖励=${m.reward}`);
  return m;
}

// ===== 收集册宝箱 =====
// 领取收集册宝箱，返回奖励对象（或 null）
export function claimCollectionChest(index) {
  const def = COLLECTION_CHESTS[index];
  if (!def) return null;
  const collected = _state.drawnHexagrams.length;
  if (collected < def.threshold) return null;
  if (_state.collectionChestClaimed.includes(index)) return null;
  _state.collectionChestClaimed.push(index);
  if (def.reward.type === 'talisman') {
    addTalisman(def.reward.id, 1);
  }
  commit();
  return def.reward;
}

// 领取新解锁卦的币胚，返回 true/false
export function claimNewHexagram(num) {
  const idx = _state.newHexagrams.indexOf(num);
  if (idx < 0) return false;
  _state.newHexagrams.splice(idx, 1);
  addFragments(1);
  commit();
  return true;
}

// ===== 成就奖励 =====
// 为新达成的成就随机生成奖励（币胚×3 或 任意符箓×1），仅改内存，调用方需 commit
export function generateAchievementReward(achId) {
  if (_state.achievementRewards[achId]) return _state.achievementRewards[achId];
  let reward;
  if (Math.random() < 0.5) {
    reward = { type: 'fragment', amount: 3 };
  } else {
    const t = TALISMANS[Math.floor(Math.random() * TALISMANS.length)];
    reward = { type: 'talisman', id: t.id, amount: 1 };
  }
  _state.achievementRewards[achId] = { reward, claimed: false };
  return _state.achievementRewards[achId];
}

// 领取成就奖励，返回奖励对象（或 null）
export function claimAchievementReward(achId) {
  const r = _state.achievementRewards[achId];
  if (!r || r.claimed) return null;
  if (r.reward.type === 'fragment') {
    addFragments(r.reward.amount);
  } else if (r.reward.type === 'talisman') {
    addTalisman(r.reward.id, r.reward.amount);
  }
  r.claimed = true;
  commit();
  return r.reward;
}

// ===== 备份提醒 =====
// 返回距上次导出的天数；从未导出返回 -1（不提醒）
export function getDaysSinceLastExport() {
  if (!_state.lastExportTime) return -1;
  return (Date.now() - _state.lastExportTime) / (24 * 60 * 60 * 1000);
}

// 记录导出时间戳
export function markExported() {
  _state.lastExportTime = Date.now();
  commit();
}

// ===== 道具系统 =====
function _todayStr() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
}

// 根据当日已转次数计算掉落概率（每日前 20 次维持基础概率，之后衰减）
export function getDropProb(spinCount) {
  if (spinCount <= CONFIG.DROP_DAILY_FREE_COUNT) return CONFIG.DROP_BASE_PROB;
  const decayed = CONFIG.DROP_BASE_PROB * Math.pow(CONFIG.DROP_DECAY_FACTOR, spinCount - CONFIG.DROP_DAILY_FREE_COUNT);
  return Math.max(CONFIG.DROP_MIN_PROB, decayed);
}

// 记录一次转盘（用于掉落衰减统计），返回记录后的当日次数
export function recordDailySpin() {
  const today = _todayStr();
  if (_state.dailyDropStats.date !== today) {
    _state.dailyDropStats = { date: today, spinCount: 0 };
  }
  _state.dailyDropStats.spinCount++;
  return _state.dailyDropStats.spinCount;
}

// 记录一次抽签（仅改内存，调用方需 commit）：把当天加入累计抽签天数集合
// 用于"持之以恒"成就的累计抽签天数统计
export function recordDrawDay() {
  const today = _todayStr();
  if (!_state.stats.drawDays) _state.stats.drawDays = [];
  if (!_state.stats.drawDays.includes(today)) {
    _state.stats.drawDays.push(today);
  }
}

// 获取累计抽签天数
export function getDrawDayCount() {
  return Array.isArray(_state.stats.drawDays) ? _state.stats.drawDays.length : 0;
}

// 独立判定本次转盘的符箓 / 币胚掉落（各算各的，但每日转盘次数只记一次）
// 命中即直接入库（仅改内存，调用方需 commit），返回 { talisman, fragment, prob }
export function rollSpinDrops() {
  const count = recordDailySpin();
  const prob = getDropProb(count);
  const result = { talisman: null, fragment: false, prob };
  if (Math.random() < prob) {
    const t = TALISMANS[Math.floor(Math.random() * TALISMANS.length)];
    result.talisman = t.id;
    addTalisman(t.id, 1);
  }
  if (Math.random() < prob) {
    result.fragment = true;
    addFragments(1);
  }
  return result;
}

// 币胚增减（仅改内存，调用方需 commit）
export function addFragments(amount) {
  _state.fragments = Math.max(0, (_state.fragments || 0) + amount);
}

// 币胚是否达到可合成数量
export function canSynthFragment() {
  return (_state.fragments || 0) >= CONFIG.FRAGMENT_SYNTH_COST;
}

// 符箓增减（仅改内存，调用方需 commit）
export function addTalisman(id, count = 1) {
  _state.talismans[id] = Math.max(0, (_state.talismans[id] || 0) + count);
}

// 消耗一张符箓，成功返回 true（仅改内存，调用方需 commit）
export function consumeTalisman(id) {
  if ((_state.talismans[id] || 0) <= 0) return false;
  _state.talismans[id]--;
  return true;
}

// 币胚合成：消耗 8 个币胚换 1 枚随机八卦币，返回所得 trigram（或 null 表示币胚不足）
export function synthFragment() {
  if (_state.fragments < CONFIG.FRAGMENT_SYNTH_COST) return null;
  _state.fragments -= CONFIG.FRAGMENT_SYNTH_COST;
  const bagua = getBaguaTypes();
  const trigram = bagua[Math.floor(Math.random() * bagua.length)];
  _state.unexchangedCoins[trigram.id] = Math.min(CONFIG.COIN_MAX_COUNT, _state.unexchangedCoins[trigram.id] + 1);
  _state.stats.totalCoinsEarned++;
  _state.stats.trigramDrawCount[trigram.id] = (_state.stats.trigramDrawCount[trigram.id] || 0) + 1;
  addCoinLog('earn', 1, `币胚合成 ${trigram.name}`);
  return trigram;
}

// 「运·时来运转」：把数量最少的八卦币类别全部并入数量最多的类别
// 返回 { from, to, moved } 或 null（背包无八卦币时）
export function useTalismanYun() {
  const bagua = getBaguaTypes();
  const withCount = bagua.map(t => ({ t, c: _state.unexchangedCoins[t.id] || 0 })).filter(x => x.c > 0);
  if (withCount.length < 2) return null; // 少于两种有币的类别无法转换
  withCount.sort((a, b) => a.c - b.c);
  const from = withCount[0];
  const to = withCount[withCount.length - 1];
  if (from.t.id === to.t.id) return null;
  const moved = from.c;
  _state.unexchangedCoins[from.t.id] = 0;
  _state.unexchangedCoins[to.t.id] = Math.min(CONFIG.COIN_MAX_COUNT, _state.unexchangedCoins[to.t.id] + moved);
  addCoinLog('spend', -moved, `时来运转 转化出 ${from.t.name}`);
  addCoinLog('earn', moved, `时来运转 转化为 ${to.t.name}`);
  return { from: from.t, to: to.t, moved };
}

// ===== 任务系统 =====
// 重置每日签到任务状态（跨日时调用）
function _resetDailyTasksIfNewDay() {
  const today = _todayStr();
  if (_state.dailyTaskState.date !== today) {
    _state.dailyTaskState = { date: today, tasks: {} };
  }
}

// 取一个每日任务的进度对象（不存在则初始化）
function _ensureDailyTask(id) {
  _resetDailyTasksIfNewDay();
  if (!_state.dailyTaskState.tasks[id]) {
    _state.dailyTaskState.tasks[id] = { progress: 0, claimed: false };
  }
  return _state.dailyTaskState.tasks[id];
}

// 取一个新手任务的进度对象（不存在则初始化）
function _ensureOnboardingTask(id) {
  if (!_state.onboardingTaskState[id]) {
    _state.onboardingTaskState[id] = { progress: 0, claimed: false };
  }
  return _state.onboardingTaskState[id];
}

// 记录每日任务进度（仅改内存，调用方需 commit）
// 返回 true 表示该任务此次刚好达成（用于 UI 红点提示）
export function recordDailyProgress(taskId, delta = 1) {
  const def = DAILY_TASKS.find(t => t.id === taskId);
  if (!def) return false;
  const t = _ensureDailyTask(taskId);
  if (t.claimed) return false;
  t.progress = Math.min(def.target, t.progress + delta);
  return t.progress >= def.target;
}

// 记录新手任务进度（仅改内存，调用方需 commit）
// 返回 true 表示该任务此次刚好达成
export function recordOnboardingProgress(taskId, delta = 1) {
  if (!ONBOARDING_TASK_IDS.has(taskId)) return false;
  const found = _findOnboardingTaskDef(taskId);
  if (!found) return false;
  const { def } = found;  // 真正的任务定义
  // 检查是否为当前条线的"激活"任务（前序任务已领奖）
  if (!_isOnboardingTaskUnlocked(taskId)) return false;
  const t = _ensureOnboardingTask(taskId);
  if (t.claimed) return false;
  if (t.progress >= def.target) return false;
  t.progress = Math.min(def.target, t.progress + delta);
  return t.progress >= def.target;
}

// 在 ONBOARDING_LINES 中查找任务定义
function _findOnboardingTaskDef(taskId) {
  for (const line of ONBOARDING_LINES) {
    const t = line.tasks.find(x => x.id === taskId);
    if (t) return { def: t, line };
  }
  return null;
}

// 判断某新手任务是否已解锁（同条线前序任务均已领取奖励）
export function _isOnboardingTaskUnlocked(taskId) {
  const found = _findOnboardingTaskDef(taskId);
  if (!found) return false;
  const { line } = found;
  const idx = line.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return false;
  for (let i = 0; i < idx; i++) {
    const prev = _state.onboardingTaskState[line.tasks[i].id];
    if (!prev || !prev.claimed) return false;
  }
  return true;
}

// 获取一条新手任务线的当前激活任务（第一个未领取的）
export function getActiveOnboardingTask(lineId) {
  const line = ONBOARDING_LINES.find(l => l.id === lineId);
  if (!line) return null;
  for (const t of line.tasks) {
    const st = _state.onboardingTaskState[t.id];
    if (!st || !st.claimed) return t;
  }
  return null; // 整条线已完成
}

// 整条线是否完成（所有任务已领取）
export function isOnboardingLineComplete(lineId) {
  const line = ONBOARDING_LINES.find(l => l.id === lineId);
  if (!line) return false;
  return line.tasks.every(t => {
    const st = _state.onboardingTaskState[t.id];
    return st && st.claimed;
  });
}

// 所有新手任务线是否全部完成（用于隐藏新手任务 Tab）
export function isAllOnboardingComplete() {
  return ONBOARDING_LINES.every(l => isOnboardingLineComplete(l.id));
}

// 检查任务按钮是否需要显示红点（有可领取的任务）
export function hasClaimableTask() {
  _resetDailyTasksIfNewDay();
  // 每日任务：进度达标但未领取
  for (const def of DAILY_TASKS) {
    const t = _state.dailyTaskState.tasks[def.id];
    if (t && !t.claimed && t.progress >= def.target) return true;
  }
  // 新手任务：当前激活任务进度达标但未领取
  for (const line of ONBOARDING_LINES) {
    for (const def of line.tasks) {
      const st = _state.onboardingTaskState[def.id];
      if (st && !st.claimed && st.progress >= def.target) return true;
    }
  }
  return false;
}

// 仅检查新手任务是否有可领取（用于新手任务tab红点）
export function hasClaimableOnboardingTask() {
  for (const line of ONBOARDING_LINES) {
    for (const def of line.tasks) {
      const st = _state.onboardingTaskState[def.id];
      if (st && !st.claimed && st.progress >= def.target) return true;
    }
  }
  return false;
}

// 领取每日任务奖励，返回发放描述字符串或 null
export function claimDailyTask(taskId) {
  const def = DAILY_TASKS.find(t => t.id === taskId);
  if (!def) return null;
  const t = _ensureDailyTask(taskId);
  if (t.claimed || t.progress < def.target) return null;

  let reward = def.reward;
  let pickLabel = '';
  // 随机奖励：领取时一次性确定选项
  if (reward.type === 'random') {
    const idx = Math.floor(Math.random() * reward.options.length);
    reward = reward.options[idx];
    if (!_state.dailyTaskState.randomPick) _state.dailyTaskState.randomPick = {};
    _state.dailyTaskState.randomPick[taskId] = idx;
    pickLabel = '（随机）';
  }
  const label = _applyReward(reward);
  t.claimed = true;
  addPointLog('earn', 0, `每日任务：${def.title}${pickLabel} → ${label}`);
  return label;
}

// 领取新手任务奖励，返回发放描述字符串或 null
export function claimOnboardingTask(taskId) {
  const found = _findOnboardingTaskDef(taskId);
  if (!found) return null;
  const { def } = found;
  const st = _ensureOnboardingTask(taskId);
  if (st.claimed || st.progress < def.target) return null;

  const label = _applyReward(def.reward);
  st.claimed = true;
  addPointLog('earn', 0, `新手任务：${def.title} → ${label}`);
  return label;
}

// 内部：发放奖励，返回描述字符串
function _applyReward(reward) {
  if (reward.type === 'fragment') {
    addFragments(reward.amount);
    return `币胚×${reward.amount}`;
  }
  if (reward.type === 'talisman') {
    addTalisman(reward.id, reward.amount);
    const t = TALISMANS.find(x => x.id === reward.id);
    return `符箓「${t ? t.name : reward.id}」×${reward.amount}`;
  }
  if (reward.type === 'point') {
    _state.points += reward.amount;
    return `积分×${reward.amount}`;
  }
  if (reward.type === 'coin') {
    // 随机获得 1 枚八卦硬币
    const bagua = getBaguaTypes();
    const tg = bagua[Math.floor(Math.random() * bagua.length)];
    _addCoinById(tg.id, 1, `新手任务奖励 ${tg.name}`);
    return `八卦硬币「${tg.name}」×1`;
  }
  if (reward.type === 'taiji') {
    _addCoinById('taiji', reward.amount, '新手任务奖励 太极');
    return `太极币×${reward.amount}`;
  }
  if (reward.type === 'trigram') {
    const t = TRIGRAMS.find(x => x.id === reward.id);
    _addCoinById(reward.id, reward.amount, `新手任务奖励 ${t ? t.name : reward.id}`);
    return `${t ? t.name : reward.id}币×${reward.amount}`;
  }
  if (reward.type === 'all_coins') {
    TRIGRAMS.forEach(t => _addCoinById(t.id, 1, `新手任务奖励 ${t.name}`));
    return '九种铜币各一枚';
  }
  return '未知奖励';
}

// 内部：增加指定铜币并更新统计/流水（自动尊重 COIN_MAX_COUNT 上限）
function _addCoinById(coinId, amount, desc) {
  const cur = _state.unexchangedCoins[coinId] || 0;
  const add = Math.min(amount, CONFIG.COIN_MAX_COUNT - cur);
  if (add <= 0) return;
  _state.unexchangedCoins[coinId] = cur + add;
  _state.stats.totalCoinsEarned += add;
  _state.stats.trigramDrawCount[coinId] = (_state.stats.trigramDrawCount[coinId] || 0) + add;
  addCoinLog('earn', add, desc);
}
