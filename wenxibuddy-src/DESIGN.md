# Design System: WB WenXiBuddy

> **唯一视觉与交互真源。** 所有页面、组件、弹窗、动效必须遵守本文。  
> 产品：液态毛玻璃（Liquid Glass）暗黑生产力 OS · 8 大模块全交互。

---

## 0. 多轮需求凝练（Implementation Canon）

以下条款来自产品对照图与多轮迭代，**优先级最高，不可回退**：

### 0.1 材质 · Liquid Glass
1. 画布必须是 **纯黑 void**（`#000`），不是深灰实心底。
2. 所有主面板使用 **半透明 + 强 blur（24–56px）+ 顶缘高光 specular + 柔和外阴影**，禁止实心 navy 卡片。
3. 强调色 **仅用 emerald/mint 霓虹**；其余信息靠白字透明度层级（0.92 / 0.68 / 0.45 / 0.32）。
4. 二级弹窗必须统一 `LiquidModal`（遮罩 blur + 弹簧缩放 + 顶光），**禁止**旧式实心 modal / 顶栏硬展开下拉占布局。
5. **所有下拉禁止原生 `<select>`**，统一 `LiquidSelect`（液态玻璃面板 + portal + 弹簧动效 + 勾选态）。

### 0.2 框架布局 · 对齐 · 留白
1. **框架式布局**：侧栏 + 主区有外 padding，面板悬浮，**空白处保持 void，不要硬撑满**。
2. 首页任务区：**左右同高**；左侧 KPI → 中部看板/CoverFlow → **时间线贴底**；右侧智能详情通高，**底部操作条与时间线下沿对齐**。
3. 任务看板列 **向右加宽**（约 48%），筛选条（全部/我负责/我参与 + 状态/排序）**永远单行** `flex-nowrap`。
4. 日程等全高页：主内容 `h-full` + 底栏贴底；子区域可滚动，不互相遮挡（`min-width:0`、`overflow` 隔离、CoverFlow `overflow:hidden`）。
5. 禁止出现 **莫名细线/残控件/滚动条伪影**（CoverFlow 底部不要夹一条细 bar；滚动条在 deck 区隐藏）。

### 0.3 CoverFlow 卡片堆
1. 卡片整体 **放大且自适应**：`clamp` 宽高随容器变化。
2. **每一张卡片右下角都有播放按钮**，随 3D 变换一起移动；禁止单独悬浮在堆中心的固定播放器。
3. **鼠标滚轮**在卡片区切换前后卡片（节流、弹簧动效）；悬停暂停自动轮播。
4. 页码用右上角小点指示，避免底部杂物。

### 0.4 动效铁律（干什么都要有动效）
| 场景 | 必须动效 |
|------|----------|
| 侧栏切换 8 大页面 | 左右方向滑入 + blur + 轻微缩放（`RouteTransition`） |
| 顶栏标题 | 交叉淡入（`TitleTransition`） |
| 日/周/月、设置 Tab、总览 Tab、分析周期 | 横向滑动 + blur（`ViewTransition`，带 direction） |
| 消息通知 / 站内信 / 所有二级弹窗 | 遮罩淡入 blur + 面板 spring 缩放上浮 + 内容错落入场（`LiquidModal`） |
| 筛选 pill / 视图 pill | `layoutId` 滑块 |
| 列表展开、选中、Hover | 高度动画 / 左边条 / `whileHover` `whileTap` |
| CoverFlow | spring 位姿 + 滚轮切换 |
| 完成任务 / 创建 | confetti（可设置关闭） |

**规则**：任何「点了有反馈」的控件，禁止瞬切无动画。`AnimatePresence` 的直接子节点必须是带 `key` 的 `motion.*`，否则 exit 无效。

### 0.5 功能完整度
1. **每个页面按钮都要可点**，二级能力走弹窗，不留死按钮。
2. 消息通知 = **弹窗**，不是顶栏下拉硬展开。
3. 日程：月/周/日三视图、预约/编辑/删除、筛选、今天、空白格双击/点击预约。
4. 设置中心：多分类填满（外观/AI/通知/账号/安全/系统），保存真实改 CSS 变量。
5. 智能分析、知识库、文件、团队、总览：筛选、下钻、导出/重算/发布等均要闭环。

### 0.6 Agent 自检清单
- [ ] 透过面板能否看到背景光晕？有顶缘高光吗？  
- [ ] 页面切换 / 视图切换 / 弹窗是否都有动效？  
- [ ] 首页是否底对齐？看板筛选是否单行？CoverFlow 是否无底部细线？  
- [ ] 播放钮是否在每张卡片右下角？滚轮能否切卡？  
- [ ] 通知是否弹窗？所有二级弹窗是否 LiquidModal？  

---

## 1. Visual Theme & Atmosphere

WenXiBuddy 是 **void-black + Liquid Glass** 的生产力界面。画布纯黑，面板半透明悬浮，emerald 霓虹作唯一强强调色。信息层级靠白字透明度，不靠大色块。

**气质**：premium · calm · AI-native · 高密度但不拥挤 · **弹性动效全程在场**。

---

## 2. Color Palette & Roles

### Canvas
| Token | Value | Role |
|-------|-------|------|
| `--void` | `#000000` | 页面画布 |
| `--glow-emerald` | `rgba(16,185,129,0.08–0.18)` | 环境光 |
| `--glow-cyan` | `rgba(56,189,248,0.05–0.10)` | 辅光 |

### Glass
| Token | Value |
|-------|-------|
| fill gradient | `rgba(255,255,255,0.09 → 0.03 → 0.04)` over `rgba(12,16,28,0.28)` |
| blur | `var(--blur-liquid)` 默认 40px（设置可改 24/40/56） |
| edge | inset white 0.06–0.18 + soft drop shadow |

### Text（opacity on white）
`0.92` 标题 · `0.68` 正文 · `0.45` 标签 · `0.32` 元信息

### Brand
Primary CTA：`#34d399 → #10b981 → #059669`，字色 `#04120c`  
Danger / Warn：`#f43f5e` / `#fbbf24`  
Status dots：emerald pulse = 进行中

---

## 3. Typography

- UI：`Plus Jakarta Sans` + 中文系统字体  
- Mono：`JetBrains Mono`（任务 ID、时间、百分比）  
- 仪表盘 chrome 11–13px；KPI 数字 26–28px；页面标题 20–22px

---

## 4. Liquid Glass Material

```css
/* 核心 .liquid-glass */
background: linear-gradient(165deg, rgba(255,255,255,.09), rgba(255,255,255,.03) 35%, rgba(255,255,255,.04)),
            rgba(12,16,28,.28);
backdrop-filter: blur(var(--blur-liquid, 40px)) saturate(160%);
border-radius: 20–22px;
box-shadow:
  inset 0 0 0 1px rgba(255,255,255,.06),
  inset 0 1px 0 rgba(255,255,255,.18),  /* specular */
  0 18px 50px -12px rgba(0,0,0,.65);
```

变体：`.liquid-glass-hover` · `.liquid-glass-active` · `.liquid-pill` · `.liquid-btn-primary` · `.liquid-btn-ghost` · `.frost-card` · `.frost-card-active`

实现：`src/index.css` + `GlassCard` + `LiquidModal`

---

## 5. Layout（框架 / 弹性 / 下对齐）

```
.app-frame: clamp(176px,14vw,280px) | 1fr ; padding clamp 流体 ; max-width: none（左右拉满）
.tasks-frame: minmax(0,1fr) | clamp(260px,24vw,400px) ; stretch ; height 100%
.tasks-left: column ; KPI → board-deck(flex1) → timeline(mt-auto)
.board-deck-row: minmax(280px,1.05fr) | minmax(240px,1fr)
.tasks-right: 通高，详情 flex，footer mt-auto 贴底
≥1600: 侧栏/详情再放宽，主区继续吃满剩余宽度
```

- **左右必须随视口自适应**，禁止写死 1600 居中导致大屏两侧空一截外壳。  
- **空白 void 在组件内部**，不是靠砍掉整页左右边距。  
- 断点：1280 详情下沉；1100 看板/堆叠；900 侧栏改顶置。  
- 工具条、筛选、视图切换：**单行 nowrap**，可横向微滚。

---

## 6. Motion System（全局强制）

实现：`src/lib/motion.ts` · `PageTransition` · `LiquidModal` · Framer Motion

| Token / 组件 | 用途 |
|--------------|------|
| `RouteTransition` + direction | 侧栏 8 页 |
| `TitleTransition` | 顶栏标题 |
| `ViewTransition` + direction | 日周月、设置 Tab、分析周期、总览 Tab |
| `LiquidModal` | 一切二级弹窗（通知/邮件/预约/编辑/预览/AI…） |
| `layoutId` pills | 导航激活、筛选、视图切换滑块 |
| spring `stiffness 280–420` | CoverFlow、按钮 press、弹窗 |

**禁止**：无 `key` 的条件渲染指望 exit 动画；弹窗外层必须是 `motion.div` 才能被 `AnimatePresence` 正确离场。

---

## 7. Components

### Sidebar
悬浮玻璃；`layoutId` 激活项；工作区下拉；**新建工作区 / 个人资料** 走 LiquidModal。

### TopBar
无实心底；搜索 pill；**铃铛/邮件打开弹窗**（非下拉占位）；新增任务菜单（任务/文档/日程）。

### KPI
四枚玻璃胶囊；点击打开列表弹窗并可定位任务。

### 任务看板
分组手风琴；选中左边 emerald 条；筛选单行。

### CoverFlow
大卡自适应；每卡右下角 Play；滚轮切卡；无底部细条杂物。

### 项目时间线
周/双周/月切换；今天；条可点联动详情。

### 智能详情
通高；底栏编辑/完成/更多；AI 建议弹窗。

### 日程
全高；月/周/日 **强切换动效**；预约 LiquidModal；右栏日程列表随日期切换带动效。

### 其它页
总览 / 文件 / 团队 / 分析 / 知识库 / 设置：内容填满、按钮闭环、弹窗统一。

---

## 8. Do / Don’t

### Do
- 纯黑 + 透玻璃 + 环境光  
- 框架 padding、底对齐、单行工具条  
- **任何切换都有动效**  
- 弹窗统一 LiquidModal  
- CoverFlow 大卡 + 每卡播放钮 + 滚轮  

### Don’t
- 实心灰块、厚描边、彩虹强调色  
- 顶栏通知下拉硬撑布局  
- 瞬切无动画  
- 面板互相遮挡、底部莫名细线  
- 死按钮、半成品二级页  

---

## 9. Page Map

| Nav | 必须能力 |
|-----|----------|
| 任务管理 | KPI、看板、CoverFlow、时间线、智能详情、新增/编辑/完成 |
| 项目总览 | 健康度/风险/团队 Tab 动效、模块下钻 |
| 文件归档 | 分类搜索、上传、预览、下载、重命名、分享、删除 |
| 日程管理 | 月周日动效、预约编辑删除、今天、筛选 |
| 团队协作 | 邀请、消息、邮件 |
| 智能分析 | 周期切换动效、KPI、建议、风险、漏斗、成员 |
| 知识库 | 搜索、分类、发布、收藏、分享 |
| 设置中心 | 六分类填满、主题 blur 生效、恢复默认 |

---

## 10. Code Mapping

| 能力 | 路径 |
|------|------|
| 液态玻璃 CSS / 框架 grid | `src/index.css` |
| 动效 tokens | `src/lib/motion.ts` |
| 路由/视图/标题过渡 | `src/components/ui/PageTransition.tsx` |
| 二级弹窗 | `src/components/ui/LiquidModal.tsx` |
| 通知弹窗 | `src/components/modals/NotificationsModal.tsx` |
| 壳与方向切换 | `src/App.tsx` |
| CoverFlow | `src/components/dashboard/CoverFlowDeck.tsx` |
| 全局状态 | `src/context/AppContext.tsx` |

---

## 11. Agent Prompt（复制即用）

```text
按 DESIGN.md 实现/修改 WB WenXiBuddy：
- 纯黑 void + Liquid Glass（blur/高光/透光），emerald 唯一强强调色
- 框架布局、底对齐、单行工具条、空白保持 void
- 任何页面/视图/弹窗/筛选切换必须有 Framer Motion 动效
- 通知与二级能力全部 LiquidModal，禁止顶栏硬展开
- CoverFlow：大卡自适应、每卡右下角 Play、滚轮切换、无底部杂线
- 所有按钮可点闭环；对照 §0 Canon 自检后再交付
```
