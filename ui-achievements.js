// ===== 成就 UI =====
import { CONFIG, getTalisman } from './config.js';
import { getState, saveState, claimAchievementReward } from './state.js';
import { $ } from './dom.js';
import { showToast } from './ui.js';
import { ACHIEVEMENT_DEFS, SCROLL_ACHIEVEMENT_DEFS, showAchievementRedDot } from './achievements.js';

// 模块私有分页状态
let achievementPage = 0;

// 奖励文案
function _achRewardLabel(reward) {
  if (reward.type === 'fragment') return `币胚×${reward.amount}`;
  if (reward.type === 'talisman') {
    const t = getTalisman(reward.id);
    return `符箓「${t ? t.abbr : ''}」×${reward.amount}`;
  }
  return '';
}

export function renderAchievements() {
  const state = getState();
  const container = $('achievement-list');
  const pagination = $('achievement-pagination');
  container.innerHTML = '';
  container.className = 'achievement-grid';

  const allItems = [];

  ACHIEVEMENT_DEFS.forEach(def => {
    const achieved = state.achievements.includes(def.id);
    const reward = state.achievementRewards[def.id];
    const rewardClaimed = !!(reward && reward.claimed);
    const rewardLabel = reward ? _achRewardLabel(reward.reward) : '';
    const claimBtn = (achieved && reward && !rewardClaimed)
      ? `<button class="btn-success btn-window ach-claim-btn" data-ach-id="${def.id}" data-sound="bonus">领奖</button>`
      : (achieved && rewardClaimed ? `<span class="ach-claimed-tag">已领取</span>` : '');
    const redDot = (achieved && reward && !rewardClaimed) ? '<span class="ach-red-dot"></span>' : '';
    allItems.push({
      html: `
        <div class="achievement-item${achieved ? ' achieved' : ''}${def.hidden && !achieved ? ' hidden' : ''}">
          ${redDot}
          <div class="achievement-icon">
            <span class="achievement-emoji">${achieved ? def.icon : (def.hidden ? '❓' : '🔒')}</span>
          </div>
          <div class="achievement-name">${achieved || !def.hidden ? def.name : '???'}</div>
          <div class="achievement-desc">${achieved || !def.hidden ? def.desc : '隐藏成就'}</div>
          ${achieved && reward ? `<div class="ach-reward-label">奖励：${rewardLabel}</div>` : ''}
          ${claimBtn}
        </div>
      `
    });
  });

  SCROLL_ACHIEVEMENT_DEFS.forEach(def => {
    const currentValue = def.check();
    for (let t = 0; t < def.tiers.length; t++) {
      const achId = `${def.id}_${t + 1}`;
      const achieved = state.achievements.includes(achId);
      const tierName = '一二三'[t];
      const target = def.tiers[t];

      if (t > 0) {
        const prevAchId = `${def.id}_${t}`;
        if (!state.achievements.includes(prevAchId)) continue;
      }

      const reward = state.achievementRewards[achId];
      const rewardClaimed = !!(reward && reward.claimed);
      const rewardLabel = reward ? _achRewardLabel(reward.reward) : '';
      const claimBtn = (achieved && reward && !rewardClaimed)
        ? `<button class="btn-success btn-window ach-claim-btn" data-ach-id="${achId}" data-sound="bonus">领奖</button>`
        : (achieved && rewardClaimed ? `<span class="ach-claimed-tag">已领取</span>` : '');
      const redDot = (achieved && reward && !rewardClaimed) ? '<span class="ach-red-dot"></span>' : '';

      allItems.push({
        html: `
        <div class="achievement-item${achieved ? ' achieved' : ''}">
          ${redDot}
          <div class="achievement-icon">
            <span class="achievement-emoji" style="${(def.id === 'houde' || def.id === 'ziqiang') ? 'color:var(--text-dark)' : ''}">${achieved ? def.icon : '🔒'}</span>
            <span class="achievement-progress">${achieved ? '✓' : `${currentValue}/${target}`}</span>
          </div>
          <div class="achievement-name">${def.name} ${tierName}</div>
          <div class="achievement-desc">${def.desc} ${target}次</div>
          ${achieved && reward ? `<div class="ach-reward-label">奖励：${rewardLabel}</div>` : ''}
          ${claimBtn}
        </div>
      `
      });
    }
  });

  if (allItems.length === 0) {
    pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(allItems.length / CONFIG.ACH_PER_PAGE);
  if (achievementPage >= totalPages) achievementPage = totalPages - 1;
  if (achievementPage < 0) achievementPage = 0;

  const start = achievementPage * CONFIG.ACH_PER_PAGE;
  const pageItems = allItems.slice(start, start + CONFIG.ACH_PER_PAGE);

  pageItems.forEach(item => {
    container.insertAdjacentHTML('beforeend', item.html);
  });

  // 绑定领取按钮
  container.querySelectorAll('.ach-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reward = claimAchievementReward(btn.dataset.achId);
      if (reward) {
        showToast(`已领取：${_achRewardLabel(reward)}`);
        renderAchievements();
        showAchievementRedDot();
      }
    });
  });

  pagination.style.display = totalPages > 1 ? 'flex' : 'none';
  $('achievement-page-info').textContent = `${achievementPage + 1} / ${totalPages}`;
  $('achievement-prev').disabled = achievementPage === 0;
  $('achievement-next').disabled = achievementPage >= totalPages - 1;
}

export function openAchievement() {
  const state = getState();
  achievementPage = 0;
  if (state.newAchievements && state.newAchievements.length > 0) {
    showAchievementCongrats();
  } else {
    renderAchievements();
    // 默认激活成就 Tab
    document.querySelectorAll('#achievement-modal .help-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'achievement');
    });
    document.querySelectorAll('#achievement-modal .help-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === 'achievement');
    });
    $('achievement-modal').classList.add('active');
  }
}

export function showAchievementCongrats() {
  const state = getState();
  const list = $('achievement-congrats-list');
  list.innerHTML = '';
  state.newAchievements.forEach(achId => {
    let name = achId, icon = '🏆', desc = '';
    const normalDef = ACHIEVEMENT_DEFS.find(d => d.id === achId);
    if (normalDef) {
      name = normalDef.name;
      icon = normalDef.icon;
      desc = normalDef.desc;
    } else {
      for (const def of SCROLL_ACHIEVEMENT_DEFS) {
        for (let t = 0; t < def.tiers.length; t++) {
          if (`${def.id}_${t + 1}` === achId) {
            name = `${def.name} ${'一二三'[t]}`;
            icon = def.icon;
            desc = `${def.desc} ${def.tiers[t]}次`;
            break;
          }
        }
      }
    }
    const item = document.createElement('div');
    item.className = 'achievement-item achieved';
    item.innerHTML = `
      <div class="achievement-icon">
        <span class="achievement-emoji" style="${(achId.startsWith('houde') || achId.startsWith('ziqiang')) ? 'color:var(--text-dark)' : ''}">${icon}</span>
      </div>
      <div class="achievement-name">${name}</div>
      <div class="achievement-desc">${desc}</div>
    `;
    list.appendChild(item);
  });
  $('achievement-congrats-modal').classList.add('active');
}

export function closeAchievementCongrats() {
  const state = getState();
  $('achievement-congrats-modal').classList.remove('active');
  state.newAchievements = [];
  saveState();
  showAchievementRedDot();
  renderAchievements();
  $('achievement-modal').classList.add('active');
}

export function closeAchievement() {
  $('achievement-modal').classList.remove('active');
}

export function prevAchievementPage() {
  if (achievementPage > 0) { achievementPage--; renderAchievements(); }
}
export function nextAchievementPage() {
  achievementPage++;
  renderAchievements();
}
