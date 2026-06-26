// ===== 成就定义与检查 =====
// check 函数通过 getState() 读取状态，避免直接持有 state 引用。

import { CONFIG, COLLECTION_CHESTS } from './config.js';
import { getState, getTotalUnexchanged, saveState, generateAchievementReward, getDrawDayCount } from './state.js';

export const ACHIEVEMENT_DEFS = [
  {
    id: 'collector',
    name: '集大成者',
    desc: '64卦每一卦都抽到过',
    hidden: false,
    icon: '📚',
    check: () => getState().drawnHexagrams.length >= CONFIG.HEXAGRAM_COUNT
  },
  {
    id: 'unlucky',
    name: '马失前蹄',
    desc: '转十次里一个至尊或机缘都没有',
    hidden: true,
    icon: '🦄',
    check: () => false // 由 spinTenTimes 触发
  }
];

export const SCROLL_ACHIEVEMENT_DEFS = [
  {
    id: 'ziqiang',
    name: '自强不息',
    desc: '累计抽到乾卦',
    icon: '☰',
    tiers: [10, 50, 100],
    check: () => getState().stats.trigramDrawCount['qian'] || 0
  },
  {
    id: 'houde',
    name: '厚德载物',
    desc: '累计抽到坤卦',
    icon: '☷',
    tiers: [10, 50, 100],
    check: () => getState().stats.trigramDrawCount['kun'] || 0
  },
  {
    id: 'caiyuan',
    name: '财源滚滚',
    desc: '累计获得铜币',
    icon: '💰',
    tiers: [100, 500, 1000],
    check: () => getState().stats.totalCoinsEarned
  },
  {
    id: 'xishui',
    name: '细水长流',
    desc: '行囊中放了铜币',
    icon: '🎒',
    tiers: [100, 500, 1000],
    check: () => getTotalUnexchanged()
  },
  {
    id: 'fugui',
    name: '富贵荣华',
    desc: '累计获得贝筹',
    icon: '⭐',
    tiers: [100, 500, 1000],
    check: () => getState().stats.totalPointsEarned
  },
  {
    id: 'zhizui',
    name: '纸醉金迷',
    desc: '累计消费贝筹',
    icon: '🛒',
    tiers: [100, 500, 1000],
    check: () => getState().stats.totalPointsSpent
  },
  {
    id: 'linlang',
    name: '琳琅满目',
    desc: '累计在商城上架商品',
    icon: '🏪',
    tiers: [10, 50, 100],
    check: () => getState().stats.totalShopItemsAdded
  },
  {
    id: 'hengxin',
    name: '持之以恒',
    desc: '累计抽签天数',
    icon: '📅',
    tiers: [10, 50, 100],
    check: () => getDrawDayCount()
  }
];

// 检查所有成就达成情况，新达成的写入 state.newAchievements
export function checkAchievements() {
  const state = getState();
  const newAchievements = [];
  ACHIEVEMENT_DEFS.forEach(def => {
    if (!state.achievements.includes(def.id) && !def.hidden && def.check()) {
      state.achievements.push(def.id);
      newAchievements.push({ id: def.id, name: def.name, icon: def.icon, desc: def.desc });
      generateAchievementReward(def.id);
      console.log(`[成就] 达成：${def.name}`);
    }
  });
  SCROLL_ACHIEVEMENT_DEFS.forEach(def => {
    const currentValue = def.check();
    for (let t = 0; t < def.tiers.length; t++) {
      const achId = `${def.id}_${t + 1}`;
      if (!state.achievements.includes(achId) && currentValue >= def.tiers[t]) {
        state.achievements.push(achId);
        newAchievements.push({ id: achId, name: `${def.name} ${'一二三'[t]}`, icon: def.icon, desc: `${def.desc} ${def.tiers[t]}个` });
        generateAchievementReward(achId);
        console.log(`[成就] 达成：${def.name} ${'一二三'[t]}`);
      }
    }
  });
  if (newAchievements.length > 0) {
    if (!state.newAchievements) state.newAchievements = [];
    state.newAchievements.push(...newAchievements.map(a => a.id));
    saveState();
    showAchievementRedDot();
  }
}

// 触发隐藏成就
export function checkAchievement(id) {
  const state = getState();
  if (!state.achievements.includes(id)) {
    state.achievements.push(id);
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
    if (!state.newAchievements) state.newAchievements = [];
    state.newAchievements.push(id);
    generateAchievementReward(id);
    saveState();
    showAchievementRedDot();
    console.log(`[成就] 达成：${def ? def.name : id}`);
  }
}

// 成就按钮红点（直接操作 DOM，不依赖 ui.js，避免循环依赖）
// 有新成就未查看 或 有未领取奖励 时显示
export function showAchievementRedDot() {
  const state = getState();
  const hasNew = state.newAchievements && state.newAchievements.length > 0;
  let hasClaimable = false;
  if (state.achievementRewards) {
    for (const id in state.achievementRewards) {
      if (!state.achievementRewards[id].claimed) { hasClaimable = true; break; }
    }
  }
  const achShow = hasNew || hasClaimable;
  const collShow = hasCollectionClaimable(state);
  // 主界面按钮：成就或收集册任一有可领取内容即显示
  const btnDot = document.querySelector('#achievement-btn .red-dot');
  if (btnDot) btnDot.classList.toggle('visible', achShow || collShow);
  // 成就弹窗内 tab（仅成就）
  const tabDot = document.querySelector('#achievement-modal .help-tab[data-tab="achievement"] .red-dot');
  if (tabDot) tabDot.classList.toggle('visible', achShow);
}

// 判断收集册是否有可领取内容（未领取宝箱 或 新解锁卦）
function hasCollectionClaimable(state) {
  if (Array.isArray(state.collectionChestClaimed)) {
    for (let i = 0; i < COLLECTION_CHESTS.length; i++) {
      const collected = state.drawnHexagrams.length;
      if (collected >= COLLECTION_CHESTS[i].threshold && !state.collectionChestClaimed.includes(i)) {
        return true;
      }
    }
  }
  if (Array.isArray(state.newHexagrams) && state.newHexagrams.length > 0) return true;
  return false;
}

// 收集册 tab 红点：有未领取宝箱 或 有新解锁卦时显示
export function showCollectionTabRedDot() {
  const state = getState();
  const show = hasCollectionClaimable(state);
  const tabDot = document.querySelector('#achievement-modal .help-tab[data-tab="collection"] .red-dot');
  if (tabDot) tabDot.classList.toggle('visible', show);
}
