// ===== 全局配置常量 =====
export const CONFIG = {
  // 铜币与抽签
  COIN_MAX_COUNT: 10000,           // 每种铜币持有上限
  HEXAGRAM_COUNT: 64,             // 卦象总数
  TAIJI_TRIGGER_MOD: 8,           // 抽签数字取模，余1时获得太极币

  // 转盘投入
  SPIN_COIN_COST: 3,              // 单次转盘消耗铜币数
  TEN_SPIN_COUNT: 10,             // 转十次的旋转次数
  TEN_SPIN_TOTAL_COINS: 30,       // 转十次总消耗铜币数

  // 奖励等级贝筹值
  TIER_C_POINTS: 1,               // 丙等
  TIER_B_POINTS: 3,               // 乙等
  TIER_A_POINTS: 5,               // 甲等
  TIER_S_POINTS: 10,              // 至尊
  BONUS_INITIAL_POINTS: 1,        // 转到机缘时先给的贝筹
  BONUS_TAIJI_REWARD: 1,          // 完成机缘挑战奖励的太极币数

  // 奖励转盘概率
  REWARD_PROB_C: 0.45,
  REWARD_PROB_B: 0.25,
  REWARD_PROB_A: 0.15,
  REWARD_PROB_BONUS: 0.10,
  REWARD_PROB_S: 0.05,

  // 机缘转盘百分比与概率
  BONUS_PCT_THREE_QUARTER: 0.75,
  BONUS_PCT_HALF: 0.50,
  BONUS_PCT_QUARTER: 0.25,
  BONUS_PCT_FREE: 0,
  BONUS_PROB_THREE_QUARTER: 0.50,
  BONUS_PROB_HALF: 0.25,
  BONUS_PROB_QUARTER: 0.15,
  BONUS_PROB_FREE: 0.10,

  // 列表上限
  MAX_MILESTONES: 9,              // 里程碑最大数量
  MAX_SHOP_ITEMS: 1000,           // 商城商品最大数量
  MAX_TASKS: 5,                   // 任务最大数量

  // ===== 道具系统 =====
  FRAGMENT_SYNTH_COST: 8,         // 合成一枚八卦硬币所需币胚数
  TALISMAN_CAI_FRAGMENT_GAIN: 3,  // 「财·招财进宝」获得的币胚数

  // 转盘掉落概率（独立判定，道具各算各的）
  DROP_BASE_PROB: 0.33,           // 基础掉落概率 33%
  DROP_DAILY_FREE_COUNT: 20,      // 每日前 20 次维持基础概率
  DROP_DECAY_FACTOR: 0.85,        // 超出 20 次后每次衰减因子（概率乘数）
  DROP_MIN_PROB: 0.05,           // 衰减后概率下限

  // 符箓样式
  TALISMAN_BG_COLOR: '#FFD700',    // 符箓黄底
  TALISMAN_TEXT_COLOR: '#A83E39',  // 符箓红字
  FRAGMENT_COLOR: '#B0B0B0',      // 币胚色

  // 分页大小
  LOG_PER_PAGE: 9,
  ACH_PER_PAGE: 12,
  COLLECTION_PER_PAGE: 16,

  // 转盘动画
  SPIN_DURATION_MS: 3100,         // 旋转动画总时长（含缓冲）
  SPIN_MIN_ROTATIONS: 5,          // 最少额外圈数
  SPIN_MAX_EXTRA_ROTATIONS: 3,    // 最多额外圈数增量
  WHEEL_AUTO_SPIN_DELAY: 300,     // 打开转盘后自动开始旋转的延迟
  WHEEL_TEXT_RADIUS_RATIO: 0.65,  // 转盘文字径向位置比例
  WHEEL_CENTER_IMG_SIZE: 36,      // 转盘中心八卦图尺寸
  WHEEL_PADDING: 4,               // 转盘边缘留白
  WHEEL_LINE_HEIGHT: 16,          // 转盘多行文字行高

  // UI 时长
  TOAST_DURATION_MS: 2000,        // 提示消息显示时长
  BONUS_NEXT_DELAY_MS: 1500,      // 机缘转盘连转间隔
  BONUS_FREE_DELAY_MS: 1000,      // 白得结果展示时长

  // 键盘按键
  KEY_ESCAPE: 'Escape',

  // 奖励等级颜色（转盘扇区色）
  TIER_C_COLOR: '#A89788',        // 丙等扇区
  TIER_B_COLOR: '#C2A785',        // 乙等扇区
  TIER_A_COLOR: '#676B58',        // 甲等扇区
  TIER_S_COLOR: '#923A35',        // 至尊扇区
  BONUS_SECTOR_COLOR: '#6A3A33',  // 机缘扇区
  BONUS_FREE_COLOR: '#923435',    // 白得扇区

  // 奖励等级颜色（结算展示色，与扇区色区分）
  TIER_C_DISPLAY_COLOR: '#8B7355', // 丙等展示
  TIER_S_DISPLAY_COLOR: '#A83E39', // 至尊展示

  // 特殊颜色
  BONUS_LABEL_COLOR: '#FFD700',    // 机缘标签底色
  TAIJI_COIN_COLOR: '#E8E8E8',     // 太极币底色

  // 内联样式常用色
  COLOR_WHITE: '#fff',
  COLOR_GRAY_SUB: '#999',
  COLOR_TAIJI_TEXT: '#1a1a2e',

  // 图片路径
  IMG_ITEM: 'img/item.png',
  IMG_BAGUA: 'img/bagua.png',

  // 本地存储键
  STORAGE_KEY: 'rewardWheelState',
  HEALTH_NOTICE_KEY: 'healthNoticeShown',
  ONBOARDING_KEY: 'onboardingShown'
};

// ===== 八卦铜币定义 =====
export const HEXAGRAM_NAMES = {
  1: '乾为天', 2: '天风姤', 3: '天山遁', 4: '天地否',
  5: '风地观', 6: '山地剥', 7: '火地晋', 8: '火天大有',
  9: '坎为水', 10: '水泽节', 11: '水雷屯', 12: '水火既济',
  13: '泽火革', 14: '雷火丰', 15: '地火明夷', 16: '地水师',
  17: '艮为山', 18: '山火贲', 19: '山天大畜', 20: '山泽损',
  21: '火泽睽', 22: '天泽履', 23: '风泽中孚', 24: '风山渐',
  25: '震为雷', 26: '雷地豫', 27: '雷水解', 28: '雷风恒',
  29: '地风升', 30: '水风井', 31: '泽风大过', 32: '泽雷随',
  33: '巽为风', 34: '风天小畜', 35: '风火家人', 36: '风雷益',
  37: '天雷无妄', 38: '火雷噬嗑', 39: '山雷颐', 40: '山风蛊',
  41: '离为火', 42: '火山旅', 43: '火风鼎', 44: '火水未济',
  45: '山水蒙', 46: '风水涣', 47: '天水讼', 48: '天火同人',
  49: '坤为地', 50: '地雷复', 51: '地泽临', 52: '地天泰',
  53: '雷天大壮', 54: '泽天夬', 55: '水天需', 56: '水地比',
  57: '兑为泽', 58: '泽水困', 59: '泽地萃', 60: '泽山咸',
  61: '水山蹇', 62: '地山谦', 63: '雷山小过', 64: '雷泽归妹'
};

export const TRIGRAMS = [
  { id: 'taiji', name: '太极', symbol: '☯', color: CONFIG.TAIJI_COIN_COLOR, range: [0, 0] },
  { id: 'qian', name: '乾', symbol: '☰', color: '#FFFFFF', range: [1, 8] },
  { id: 'kan',  name: '坎', symbol: '☵', color: '#4169E1', range: [9, 16] },
  { id: 'gen',  name: '艮', symbol: '☶', color: '#8B6914', range: [17, 24] },
  { id: 'zhen', name: '震', symbol: '☳', color: '#2E8B57', range: [25, 32] },
  { id: 'xun',  name: '巽', symbol: '☴', color: '#90EE90', range: [33, 40] },
  { id: 'li',   name: '离', symbol: '☲', color: '#DC143C', range: [41, 48] },
  { id: 'kun',  name: '坤', symbol: '☷', color: '#B8860B', range: [49, 56] },
  { id: 'dui',  name: '兑', symbol: '☱', color: CONFIG.BONUS_LABEL_COLOR, range: [57, 64] }
];

// 后天八卦排列顺序（荷包展示用）
export const COIN_DISPLAY_ORDER = ['xun', 'li', 'kun', 'zhen', 'taiji', 'dui', 'gen', 'kan', 'qian'];

// ===== 奖励转盘扇区定义 =====
export const REWARD_SECTORS = [
  { label: '丙等',  prob: CONFIG.REWARD_PROB_C, color: CONFIG.TIER_C_COLOR, value: CONFIG.TIER_C_POINTS },
  { label: '乙等',  prob: CONFIG.REWARD_PROB_B, color: CONFIG.TIER_B_COLOR, value: CONFIG.TIER_B_POINTS },
  { label: '甲等',  prob: CONFIG.REWARD_PROB_A, color: CONFIG.TIER_A_COLOR, value: CONFIG.TIER_A_POINTS },
  { label: '机缘', prob: CONFIG.REWARD_PROB_BONUS, color: CONFIG.BONUS_SECTOR_COLOR, value: 'bonus' },
  { label: '至尊', prob: CONFIG.REWARD_PROB_S, color: CONFIG.TIER_S_COLOR, value: CONFIG.TIER_S_POINTS }
];

// ===== 机缘转盘扇区定义 =====
export const BONUS_SECTORS = [
  { label: '四分之三', prob: CONFIG.BONUS_PROB_THREE_QUARTER, color: CONFIG.TIER_C_COLOR, pct: CONFIG.BONUS_PCT_THREE_QUARTER },
  { label: '一半', prob: CONFIG.BONUS_PROB_HALF, color: CONFIG.TIER_B_COLOR, pct: CONFIG.BONUS_PCT_HALF },
  { label: '四分之一', prob: CONFIG.BONUS_PROB_QUARTER, color: CONFIG.TIER_A_COLOR, pct: CONFIG.BONUS_PCT_QUARTER },
  { label: '白得', prob: CONFIG.BONUS_PROB_FREE, color: CONFIG.BONUS_FREE_COLOR, pct: CONFIG.BONUS_PCT_FREE }
];

// 机缘item显示文字转换
export function bonusDisplayLabel(label) {
  if (label === '四分之三') return '¾';
  if (label === '四分之一') return '¼';
  return label;
}

// ===== 纯数据查询函数 =====
export function getTrigram(id) {
  return TRIGRAMS.find(t => t.id === id);
}

export function numberToTrigram(num) {
  return TRIGRAMS.find(t => num >= t.range[0] && num <= t.range[1]);
}

// 获取八卦币列表（不含太极）
export function getBaguaTypes() {
  return TRIGRAMS.filter(t => t.id !== 'taiji');
}

// ===== 符箓定义 =====
// abbr: 方块内简称；name: 下方全称；desc: 悬浮使用说明
export const TALISMANS = [
  { id: 'yi',    abbr: '宜', name: '诸事皆宜', desc: '下一次抽签奖励翻倍，不可叠加使用' },
  { id: 'yun',   abbr: '运', name: '时来运转', desc: '随机选择数量最少的八卦币类别，将其全部转化为数量最多的类别（背包无硬币时不可用）' },
  { id: 'cheng', abbr: '成', name: '心想事成', desc: '无需执行任务，直接抽签一次' },
  { id: 'cai',   abbr: '财', name: '招财进宝', desc: '随机获得 3 个币胚' }
];

export function getTalisman(id) {
  return TALISMANS.find(t => t.id === id);
}

// ===== 收集册宝箱 =====
// 每收集 16 个卦象解锁一个宝箱，共 4 个，分别奖励四种符箓
export const COLLECTION_CHESTS = [
  { threshold: 16, reward: { type: 'talisman', id: 'yi' } },
  { threshold: 32, reward: { type: 'talisman', id: 'yun' } },
  { threshold: 48, reward: { type: 'talisman', id: 'cheng' } },
  { threshold: 64, reward: { type: 'talisman', id: 'cai' } }
];

// ===== 任务系统定义 =====
// 奖励类型：fragment=币胚 / talisman=符箓 / point=积分 / coin=八卦硬币
// 奖励字段 { type, id?, amount }：talisman 需 id，其余按 amount 发放（coin amount=固定1枚）

// 每日签到任务：固定3条，每日0点重置完成状态
export const DAILY_TASKS = [
  {
    id: 'daily_open',
    title: '打开页面',
    target: 1,
    desc: '触发条件：打开页面',
    reward: { type: 'fragment', amount: 1 }
  },
  {
    id: 'daily_lottery',
    title: '完成1次抽奖',
    target: 1,
    desc: '触发条件：完成1次抽奖',
    reward: { type: 'fragment', amount: 2 }
  },
  {
    id: 'daily_invest',
    title: '完成1次投币',
    target: 1,
    desc: '触发条件：完成1次投币',
    // 随机发放：币胚x3 或 符箓x1（领取时随机判定，记录实际选项到 dailyTaskRandomPick）
    reward: { type: 'random', options: [
      { type: 'fragment', amount: 3 },
      { type: 'talisman', id: 'cheng', amount: 1 }   // 简化：随机符箓取「成」
    ] }
  }
];

// 新手任务六条线：起卦 / 观象 / 定数 / 市易 / 实录 / 归藏
// 每条线按顺序逐个解锁（前一个完成且领奖后才解锁下一个）
// goal: 埋点事件 id，由 recordOnboardingProgress 触发
// goto: 前往按钮跳转动作 key（由 ui-tasks.js 路由）
// unlockAfter: 该线解锁需要的前置线 id（无则默认解锁）：
//   - 归藏线：起卦线完成后激活
//   - 市易线：定数线完成后激活
//   - 实录线：市易线完成后激活
export const ONBOARDING_LINES = [
  {
    id: 'qigua',         // 起卦（摇奖线）
    name: '起卦',
    tasks: [
      { id: 'ob_draw1',     title: '抽一次签',         target: 1, reward: { type: 'fragment', amount: 5 }, goto: 'draw' },
      { id: 'ob_draw10',    title: '抽十次签',         target: 1, reward: { type: 'talisman', id: 'cheng', amount: 1 }, goto: 'draw_ten' },
      { id: 'ob_spin1',     title: '转一次奖励转盘',   target: 1, reward: { type: 'fragment', amount: 3 }, goto: 'spin' },
      { id: 'ob_spin10',    title: '转十次奖励转盘',   target: 1, reward: { type: 'coin', amount: 1 }, goto: 'spin_ten' }
    ]
  },
  {
    id: 'guanxiang',      // 观象（主题和收集线）
    name: '观象',
    tasks: [
      { id: 'ob_view_coin',    title: '在抽奖结果弹窗点击硬币查看卦象', target: 1, reward: { type: 'fragment', amount: 2 }, goto: 'draw' },
      { id: 'ob_view_hex',     title: '在收集册查看一次卦象',   target: 1, reward: { type: 'talisman', id: 'yi', amount: 1 }, goto: 'collection' }
    ]
  },
  {
    id: 'dingshu',        // 定数（奖励设置线）
    name: '定数',
    tasks: [
      { id: 'ob_add_task',       title: '添加一个任务',         target: 1, reward: { type: 'fragment', amount: 3 }, goto: 'settings' },
      { id: 'ob_edit_task',      title: '编辑一个任务',         target: 1, reward: { type: 'fragment', amount: 3 }, goto: 'settings' },
      { id: 'ob_add_milestones', title: '添加3个里程碑',        target: 3, reward: { type: 'talisman', id: 'yun', amount: 1 }, goto: 'settings' },
      { id: 'ob_claim_milestone', title: '开箱一个里程碑',      target: 1, reward: { type: 'fragment', amount: 3 }, goto: 'settings' }
    ]
  },
  {
    id: 'shiyi',          // 市易（商城线，定数线完成后解锁）
    name: '市易',
    unlockAfter: 'dingshu',
    tasks: [
      { id: 'ob_add_shop',       title: '添加3个商品',         target: 3, reward: { type: 'point', amount: 5 }, goto: 'settings_shop' },
      { id: 'ob_buy_shop',       title: '购买一个商品',         target: 1, reward: { type: 'talisman', id: 'cai', amount: 1 }, goto: 'shop' },
      { id: 'ob_del_shop',       title: '删除一个商品',         target: 1, reward: { type: 'fragment', amount: 1 }, goto: 'settings_shop' }
    ]
  },
  {
    id: 'shilu',         // 实录（数据导出线，市易线完成后解锁）
    name: '实录',
    unlockAfter: 'shiyi',
    tasks: [
      { id: 'ob_export',         title: '导出数据',             target: 1, reward: { type: 'fragment', amount: 3 }, goto: 'settings' }
    ]
  },
  {
    id: 'guizang',       // 归藏（起卦线完成后解锁）
    name: '归藏',
    unlockAfter: 'qigua',
    tasks: [
      { id: 'ob_view_coin_count', title: '查看荷包内硬币数量', target: 1, reward: { type: 'fragment', amount: 8 }, goto: 'backpack' },
      { id: 'ob_synth',           title: '合成币胚',       target: 1, reward: { type: 'talisman', id: 'cai', amount: 1 }, goto: 'fragment' },
      { id: 'ob_use_talis',       title: '使用一张符箓',       target: 1, reward: { type: 'point', amount: 5 }, goto: 'talisman' },
      { id: 'ob_view_points_log', title: '查看贝筹流水',       target: 1, reward: { type: 'talisman', id: 'yun', amount: 1 }, goto: 'points_log' }
    ]
  }
];

// 把所有新手任务的 id 扁平化为集合，便于埋点时快速查找
export const ONBOARDING_TASK_IDS = new Set(
  ONBOARDING_LINES.flatMap(line => line.tasks.map(t => t.id))
);
