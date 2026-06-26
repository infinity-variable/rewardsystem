// ===== 默认设置 =====
// 用户初次登录时（无本地存储数据）应用的默认设置。
// 包含里程碑奖励、商城商品、任务三项。

export const DEFAULT_MILESTONES = [
  { count: 10, reward: '影片日', achieved: false },
  { count: 20, reward: '推拿一次', achieved: false },
  { count: 50, reward: '山野旅行三天', achieved: false }
];

export const DEFAULT_SHOP_ITEMS = [
  { emoji: '📺', name: '短视频15m', cost: 10, limit: 'unlimited' },
  { emoji: '🍦', name: '冰淇淋', cost: 15, limit: 'unlimited' },
  { emoji: '🍟', name: '炸薯条', cost: 20, limit: 'unlimited' }
];

export const DEFAULT_TASKS = [
  { name: '四平马步', count: 60, unit: 's' }
];
