// ===== DOM 查询辅助 =====
// 共享简写，避免在各 UI 模块中重复定义。
export const $ = id => document.getElementById(id);

// HTML 转义：将用户输入安全地插入 innerHTML 或属性值。
// 转义 & < > " '，防止 XSS 与属性截断。
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
