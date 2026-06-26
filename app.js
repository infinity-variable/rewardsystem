// ===== 应用入口 =====
// 原单文件已按职责拆分为 ES Module：
//   config.js            常量、卦象数据、扇区定义、纯数据函数
//   dom.js               共享 DOM 查询辅助 $
//   text.js              周易文本懒加载与缓存
//   state.js             私有 state + 订阅模式 + 迁移/查询/变更助手
//   achievements.js      成就定义与检查
//   ui.js                Toast、updateUI、进度条、贝筹流水（核心）
//     ui-backpack.js     荷包（铜币）与铜币流水
//     ui-shop.js         贝筹商城
//     ui-settings.js     设置（任务/里程碑/商城编辑）
//     ui-achievements.js 成就列表与恭喜弹窗
//     ui-collection.js   收集册与卦象详情
//   wheels.js            转盘绘制/旋转/选区/旋转锁（核心）
//     lottery.js         抽签（单抽/十抽）
//     reward-wheel.js    奖励转盘与十连转
//     bonus-wheel.js     机缘转盘与挑战
//   events.js            DOMContentLoaded 事件绑定
//
// 本文件仅作为入口，导入 events.js 即可触发事件绑定与首屏渲染。
// state 为模块私有，外部通过 state.js 的 getState/commit/subscribe 访问。

import './events.js';
