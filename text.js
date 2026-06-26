// ===== 周易文本加载与解析 =====
// 文本懒加载，首次访问卦象详情时才 fetch，并缓存结果

let _benjingCache = null;   // 周易本经：{卦名: 文本块}
let _daxiangCache = null;   // 大象传：{卦名: 象曰内容}
let _guafuCache = null;     // 卦符：{卦名: 卦符字符}
let _textLoadingPromise = null;

export async function loadHexagramTexts() {
  if (_benjingCache && _daxiangCache && _guafuCache) return;
  if (_textLoadingPromise) return _textLoadingPromise;
  _textLoadingPromise = (async () => {
    const [benjingRes, daxiangRes, guafuRes] = await Promise.all([
      fetch('text/周易本经.txt'),
      fetch('text/大象传.txt'),
      fetch('text/卦符.txt')
    ]);
    const benjingText = await benjingRes.text();
    const daxiangText = await daxiangRes.text();
    const guafuText = await guafuRes.text();

    // 解析周易本经：按 ━━━ 分隔线切块，从标题行提取卦名
    _benjingCache = {};
    const blocks = benjingText.split(/^━+$/m);
    for (const block of blocks) {
      const m = block.match(/第[一二三四五六七八九十百]+卦\s+(.+?)（/);
      if (m) _benjingCache[m[1].trim()] = block.trim();
    }

    // 解析大象传：每行 "卦名-象曰：内容"
    _daxiangCache = {};
    daxiangText.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line === '下经') return;
      const idx = line.indexOf('-');
      if (idx > 0) {
        _daxiangCache[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
      }
    });

    // 解析卦符：每行 "卦名：卦符"
    _guafuCache = {};
    guafuText.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;
      const idx = line.indexOf('：');
      if (idx > 0) {
        _guafuCache[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
      }
    });
  })();
  return _textLoadingPromise;
}

export function getBenjingText(name) {
  return _benjingCache ? (_benjingCache[name] || '') : '';
}

export function getDaxiangText(name) {
  return _daxiangCache ? (_daxiangCache[name] || '') : '';
}

export function getGuafuText(name) {
  return _guafuCache ? (_guafuCache[name] || '') : '';
}
