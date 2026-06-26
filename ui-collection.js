// ===== 收集册与卦象详情 =====
import { CONFIG, HEXAGRAM_NAMES, numberToTrigram, COLLECTION_CHESTS, getTalisman } from './config.js';
import { getState, commit, claimCollectionChest, claimNewHexagram } from './state.js';
import { $ } from './dom.js';
import { loadHexagramTexts, getBenjingText, getDaxiangText, getGuafuText } from './text.js';
import { recordTaskEvent } from './tasks-tracker.js';
import { showToast } from './ui.js';

// 模块私有分页状态
let collectionPage = 0;

// 渲染收集册进度条 + 4 个宝箱
function renderCollectionProgress() {
  const state = getState();
  const chestsContainer = $('collection-progress-chests');
  const fill = $('collection-progress-fill');
  const label = $('collection-progress-label');
  if (!chestsContainer) return;
  chestsContainer.innerHTML = '';

  const collected = state.drawnHexagrams.length;
  const maxCount = 64;
  const fillPct = Math.min(100, (collected / maxCount) * 100);
  fill.style.width = fillPct + '%';

  label.textContent = `${collected}`;
  label.style.left = fillPct + '%';

  COLLECTION_CHESTS.forEach((chest, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'chest-wrapper';
    const pct = (chest.threshold / maxCount) * 100;
    wrapper.style.left = pct + '%';

    const btn = document.createElement('button');
    btn.className = 'collection-chest-btn';
    const claimed = state.collectionChestClaimed.includes(i);
    const achieved = collected >= chest.threshold;

    if (claimed) {
      btn.classList.add('claimed');
      btn.title = '已领取';
    } else if (achieved) {
      btn.classList.add('achieved');
      const tal = getTalisman(chest.reward.id);
      btn.title = `点击领取：${tal ? tal.name : ''}`;
      // 达成后右上角红点引导
      const dot = document.createElement('span');
      dot.className = 'chest-red-dot';
      btn.appendChild(dot);
      btn.addEventListener('click', () => {
        const reward = claimCollectionChest(i);
        if (reward) {
          const tal = getTalisman(reward.id);
          showToast(`收集册宝箱：获得符箓「${tal ? tal.abbr : ''}」`);
          renderCollectionProgress();
        }
      });
    } else {
      btn.title = `收集 ${chest.threshold} 个卦象解锁`;
    }

    const lbl = document.createElement('div');
    lbl.className = 'chest-label';
    lbl.textContent = chest.threshold;

    wrapper.appendChild(btn);
    wrapper.appendChild(lbl);
    chestsContainer.appendChild(wrapper);
  });
}

export async function renderCollection() {
  const state = getState();
  const container = $('collection-grid');
  const pagination = $('collection-pagination');
  container.innerHTML = '';
  container.className = 'collection-grid';

  // 渲染进度条
  renderCollectionProgress();
  // 更新收集计数
  const countEl = $('collection-count');
  if (countEl) countEl.textContent = `${state.drawnHexagrams.length}/64`;

  // 卦符文本需先加载，未加载时先显示编号，加载完成后刷新
  const textsReady = !!(getGuafuText(HEXAGRAM_NAMES[1]));
  if (!textsReady) {
    loadHexagramTexts().then(() => renderCollection());
  }

  const allHexagrams = [];
  for (let i = 1; i <= 64; i++) {
    allHexagrams.push(i);
  }

  const totalPages = Math.ceil(allHexagrams.length / CONFIG.COLLECTION_PER_PAGE);
  if (collectionPage >= totalPages) collectionPage = totalPages - 1;
  if (collectionPage < 0) collectionPage = 0;

  const start = collectionPage * CONFIG.COLLECTION_PER_PAGE;
  const pageHexagrams = allHexagrams.slice(start, start + CONFIG.COLLECTION_PER_PAGE);

  pageHexagrams.forEach(num => {
    const collected = state.drawnHexagrams.includes(num);
    const name = HEXAGRAM_NAMES[num] || '???';
    // 卦符（䷀-䷿）来自 卦符.txt，以卦名为 key 查询；未加载时回退显示编号
    const guafu = textsReady ? (getGuafuText(name) || num) : num;
    // 宫位颜色：复用 numberToTrigram(num).color，与抽奖结果界面上色逻辑一致
    const trigramColor = numberToTrigram(num)?.color || '';
    const isNew = state.newHexagrams.includes(num);
    const item = document.createElement('div');
    // 类名与 style.css 一致：drawn 表示已收集（红框高亮）
    item.className = 'collection-item' + (collected ? ' drawn' : '');
    item.innerHTML = `
      <div class="collection-icon"><div class="collection-icon-inner" style="background:${trigramColor}">${collected ? guafu : num}</div></div>
      <div class="collection-name">${collected ? name : '???'}</div>
      ${isNew ? '<span class="hex-red-dot"></span>' : ''}
    `;
    if (collected) {
      item.addEventListener('click', () => {
        // 优先领取新卦币胚
        if (state.newHexagrams.includes(num)) {
          if (claimNewHexagram(num)) {
            showToast('获得币胚×1');
            commit();
            renderCollection();
            return;
          }
        }
        showHexagramDetail(num);
      });
    }
    container.appendChild(item);
  });

  pagination.style.display = totalPages > 1 ? 'flex' : 'none';
  $('collection-page-info').textContent = `${collectionPage + 1} / ${totalPages}`;
  $('collection-prev').disabled = collectionPage === 0;
  $('collection-next').disabled = collectionPage >= totalPages - 1;
}

export function openCollection() {
  collectionPage = 0;
  renderCollection();
  // 切换到收集册 Tab 并打开成就弹窗
  document.querySelectorAll('#achievement-modal .help-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === 'collection');
  });
  document.querySelectorAll('#achievement-modal .help-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === 'collection');
  });
  $('achievement-modal').classList.add('active');
}

export function closeCollection() {
  // 收集册已合并为成就弹窗的 Tab，切回成就 Tab
  document.querySelectorAll('#achievement-modal .help-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === 'achievement');
  });
  document.querySelectorAll('#achievement-modal .help-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === 'achievement');
  });
}

export function prevCollectionPage() {
  if (collectionPage > 0) { collectionPage--; renderCollection(); }
}
export function nextCollectionPage() {
  collectionPage++;
  renderCollection();
}

export async function showHexagramDetail(num) {
  const name = HEXAGRAM_NAMES[num] || `第${num}卦`;
  const titleDiv = $('hexagram-detail-title');
  const benjingDiv = $('hexagram-detail-benjing');
  const daxiangDiv = $('hexagram-detail-daxiang');

  titleDiv.textContent = name;
  benjingDiv.textContent = '加载中...';
  daxiangDiv.textContent = '加载中...';

  $('hexagram-detail-modal').classList.add('active');

  await loadHexagramTexts();
  // 文本缓存以卦名为 key，需用 name 查询而非 num
  benjingDiv.textContent = getBenjingText(name) || '暂无';
  daxiangDiv.textContent = getDaxiangText(name) || '暂无';
  // 任务埋点：在收集册查看一次卦象
  recordTaskEvent('view_hexagram');
}

export function closeHexagramDetail() {
  $('hexagram-detail-modal').classList.remove('active');
}
