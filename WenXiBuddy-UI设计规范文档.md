# WenXiBuddy（问习伙伴）UI 设计规范与开发复刻文档

> **本文档基于真实代码仓库 `lllll081926i/wenxibuddy` 逆向梳理**，与项目 `DESIGN.md`「设计系统真源」对齐。
> 目标：UI 设计师与前端开发仅凭本文档即可高保真复刻 WenXiBuddy —— 一款 **纯黑 void + 液态毛玻璃（Liquid Glass）** 的暗黑生产力 OS。

---

## 📌 核心一句话

> **画布纯黑 `#000`，面板半透明悬浮（blur 40px + 顶缘高光），emerald 霓虹绿是唯一强强调色，信息层级靠白字透明度（0.92 / 0.68 / 0.45 / 0.32）而非色块；任何切换都必须有 Framer Motion 动效；所有二级交互走统一的 `LiquidModal`。**

---

## 目录

1. [技术栈与工程结构](#1-技术栈与工程结构)
2. [设计真源（Canon · 不可回退条款）](#2-设计真源canon--不可回退条款)
3. [UI 设计规范](#3-ui-设计规范)
   - 3.1 色彩系统（含真实 CSS 变量）
   - 3.2 字体排版
   - 3.3 液态玻璃材质（核心）
   - 3.4 组件原子库（含真实 className）
   - 3.5 图标规范
4. [框架布局规范](#4-框架布局规范)
5. [动效系统](#5-动效系统)
6. [页面要求（8 大模块逐页）](#6-页面要求8-大模块逐页)
7. [数据模型（TypeScript）](#7-数据模型typescript)
8. [功能点清单](#8-功能点清单)
9. [交互与状态规范](#9-交互与状态规范)
10. [响应式断点](#10-响应式断点)
11. [开发交付与自检清单](#11-开发交付与自检清单)

---

## 1. 技术栈与工程结构

### 1.1 技术栈（`package.json` 实测）

| 类别 | 选型 | 版本 |
|------|------|------|
| 框架 | **React** | 19 |
| 语言 | **TypeScript** | ~5.7 |
| 构建 | **Vite 6** | `@vitejs/plugin-react` |
| 样式 | **Tailwind CSS v4** | `@tailwindcss/vite`（注意：v4 用 `@import "tailwindcss"` + `@theme {}`，**无 tailwind.config.js**） |
| 动画 | **Framer Motion** | ^12.4.7 |
| 图标 | **lucide-react** | ^0.475 |
| 效果 | **canvas-confetti** | ^1.9.4（完成任务/创建彩屑） |
| 工具 | clsx + tailwind-merge | 类名合并 |

> ⚠️ **关键**：项目**不使用 react-router**，路由是 `App.tsx` 里 `useState<NavTab>` + `switch` 渲染，配合 `RouteTransition` 做方向感知切换动画。状态管理用原生 `Context`（`AppContext`），无 Redux/Zustand。

### 1.2 工程结构

```
src/
├── App.tsx                      # 路由壳 + TAB_ORDER 方向计算 + 主布局
├── main.tsx                     # 入口
├── index.css                    # 液态玻璃系统 + 框架布局（核心样式真源）
├── lib/motion.ts                # 动效 tokens（spring/variants）
├── types/index.ts               # 数据模型
├── context/AppContext.tsx       # 全局状态（任务/文件/工作区/主题/弹窗）
├── components/
│   ├── layout/   Sidebar.tsx · TopBar.tsx
│   ├── dashboard/ KPICardsRow · TaskGroupList · CoverFlowDeck · ProjectTimeline · AISmartDetailPanel
│   ├── modals/   NewTaskModal · EditTaskModal · NotificationsModal · DocPreviewModal
│   └── ui/       LiquidModal · LiquidSelect · GlassCard · MotionButton · PageTransition · StatusBadge · Toast
└── pages/        TaskManagementPage · ProjectOverviewPage · FileDocumentsPage · ScheduleManagementPage
                  TeamCollaborationPage · AIAnalyticsPage · KnowledgeBasePage · SettingsCenterPage
```

### 1.3 命令

```bash
npm run dev      # 本地开发，端口 3000，--host 可局域网访问
npm run build    # tsc -b && vite build → dist/
npm run preview  # 预览生产构建
```

---

## 2. 设计真源（Canon · 不可回退条款）

> 摘自项目 `DESIGN.md §0`，**优先级最高，不可回退**。

### 2.1 材质 · Liquid Glass

1. 画布必须是 **纯黑 void `#000`**，不是深灰实心底。
2. 主面板 = **半透明 + 强 blur（24–56px）+ 顶缘高光 specular + 柔和外阴影**，**禁止实心 navy 卡片**。
3. 强调色 **仅用 emerald/mint 霓虹绿**；其余信息靠白字透明度层级。
4. 二级弹窗统一 `LiquidModal`（遮罩 blur + 弹簧缩放 + 顶光），**禁止**旧式实心 modal / 顶栏硬展开下拉占布局。
5. **所有下拉禁止原生 `<select>`**，统一 `LiquidSelect`（portal + 弹簧 + 勾选态）。

### 2.2 框架布局

1. **框架式布局**：侧栏 + 主区有外 padding，面板悬浮，**空白处保持 void，不要硬撑满**。
2. 首页任务区：**左右同高**；左侧 KPI → 中部看板/CoverFlow → **时间线贴底**；右侧智能详情通高，**底部操作条与时间线下沿对齐**。
3. 看板筛选条（全部/我负责/我参与 + 状态/排序）**永远单行** `flex-nowrap`。
4. 全高页：主内容 `h-full` + 底栏贴底；子区域可滚动，`min-width:0` + `overflow` 隔离。
5. **禁止**莫名细线/残控件（CoverFlow 底部不夹细 bar；deck 区隐藏滚动条）。

### 2.3 CoverFlow 卡片堆

1. 卡片 **放大且自适应**（`clamp` 随容器变化）。
2. **每张卡片右下角都有播放按钮**，随 3D 变换移动；禁止固定悬浮播放器。
3. **鼠标滚轮**在卡片区切前后卡（节流 + 弹簧）；悬停暂停自动轮播。
4. 页码用右上角小点指示。

### 2.4 动效铁律

> **任何「点了有反馈」的控件，禁止瞬切无动画。**

`AnimatePresence` 直接子节点必须是带 `key` 的 `motion.*`，否则 exit 无效。

---

## 3. UI 设计规范

### 3.1 色彩系统（真实 CSS 变量，取自 `index.css @theme`）

#### 基础 Token

```css
@theme {
  --color-void:    #000000;                          /* 画布纯黑 */
  --color-ink:     #05070c;                          /* 次级深底 */
  --color-glass:        rgba(255, 255, 255, 0.045);  /* 玻璃基础填充 */
  --color-glass-strong: rgba(255, 255, 255, 0.08);   /* 玻璃强填充 */
  --color-edge:        rgba(255, 255, 255, 0.14);    /* 描边 */
  --color-edge-soft:   rgba(255, 255, 255, 0.07);    /* 软描边 */
  --color-neon:    #22c55e;                          /* 霓虹绿锚点 */
  --blur-liquid:   40px;                             /* 玻璃模糊（设置可改 24/40/56）*/
  --radius-glass:  22px;                             /* 玻璃圆角 */
}
```

#### 文本透明度层级（白字 + opacity，**不用灰色**）

| 层级 | opacity | 用途 |
|------|---------|------|
| 标题/主数值 | `0.92` | `text-white` 实际呈现 |
| 正文 | `0.68` | 描述、列表项 |
| 标签 | `0.45` | 次级标签、元信息 |
| 元信息 | `0.32–0.35` | 时间戳、ID、占位符 |

> 工具类：`.text-soft { color: rgba(255,255,255,0.68) }`、`.text-mute { color: rgba(255,255,255,0.42) }`

#### 强调色 / 语义色

| 角色 | 色值 | 用途 |
|------|------|------|
| **Primary CTA**（emerald 渐变） | `#34d399 → #10b981 → #059669` | 主按钮、激活态、品牌 |
| Primary 字色 | `#04120c` | emerald 按钮上文字（深绿黑） |
| emerald light | `#34d399` / `text-emerald-300` | 激活图标、强调文字 |
| 环境光 glow-emerald | `rgba(16,185,129,0.08–0.18)` | 背景径向光晕 |
| 辅光 glow-cyan | `rgba(56,189,248,0.05–0.10)` | 背景辅光 |
| Danger | `#f43f5e`（rose-500）| 逾期、删除 |
| Warn | `#fbbf24`（amber-400）| 中优先级 |
| Status 已完成 | `text-blue-300` + `bg-blue-500/10` | 已完成状态点 |
| Status 进行中 | emerald pulse | 脉冲点 |

#### 状态徽章配色矩阵（取自 `StatusBadge.tsx`）

| 维度 | 值 | 文字 | 背景 | 描边 |
|------|----|----|------|------|
| **优先级 priority** | 高/紧急 | emerald-400 | `emerald-500/15` | `emerald-500/30` + glow |
| | 中 | amber-400 | `amber-500/15` | `amber-500/30` |
| | 低 | slate-400 | `slate-500/15` | `slate-500/30` |
| **状态 status** | 进行中 | emerald-300 | `emerald-500/10` | `emerald-500/20`（点 pulse）|
| | 已完成 | blue-300 | `blue-500/10` | `blue-500/20` |
| | 已延期 | rose-300 | `rose-500/10` | `rose-500/20` |
| | 待处理 | slate-300 | `slate-500/10` | `slate-500/20` |
| **阶段 phase** | 需求评审 | emerald-400 | `emerald-500/10` | `emerald-500/20` |
| | 产品设计 | cyan-400 | `cyan-500/10` | `cyan-500/20` |
| | 开发实现 | purple-400 | `purple-500/10` | `purple-500/20` |

### 3.2 字体排版

```css
--font-sans: "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

| 层级 | 字号 | 字重 | 用途 | 字体 |
|------|------|------|------|------|
| 页面标题 H1 | 20–22px | 700 | 顶栏标题 | sans |
| 副标题 | 11px | 500 | 顶栏 subtitle | sans |
| 区块标题 H3 | 13px | 700 | 看板/详情块标题 | sans |
| 卡片标题 | 17–18px | 700 | 弹窗/详情主标题 | sans |
| KPI 数字 | **28px** | 800 | KPI 大数字（`tabular-nums`） | sans |
| 正文 | 12px | 400/500 | 描述、列表 | sans |
| 小字 | 11px | 400/500 | 标签、按钮 | sans |
| 极小 | 10px | — | 时间戳、ID | sans |
| **Mono** | 10–12px | 400 | 任务 ID、时间、百分比、坐标 | **JetBrains Mono** |

> 正文与界面以 **12–13px** 为主，高密度但不拥挤。`::selection` 选中色为 `rgba(34,197,94,0.28)` 底 + `#ecfdf5` 字。

### 3.3 液态玻璃材质（核心 · 取自 `index.css`）

这是整个产品的灵魂。所有主面板复用以下 class，**不要自造**：

#### `.liquid-glass`（核心面板材质）

```css
.liquid-glass {
  background:
    linear-gradient(165deg,
      rgba(255,255,255,0.09) 0%,
      rgba(255,255,255,0.03) 35%,
      rgba(255,255,255,0.015) 70%,
      rgba(255,255,255,0.04) 100%),
    rgba(12,16,28,0.28);
  backdrop-filter: blur(var(--blur-liquid)) saturate(160%);
  border-radius: var(--radius-glass);            /* 22px */
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.06) inset,      /* 内描边 */
    0 1px 0 0 rgba(255,255,255,0.18) inset,      /* ★顶缘高光 specular */
    0 -1px 0 0 rgba(0,0,0,0.35) inset,           /* 底缘暗影 */
    0 18px 50px -12px rgba(0,0,0,0.65),          /* 主投影 */
    0 4px 16px rgba(0,0,0,0.35);
}
```

- `::before` 伪元素：125° 斜向高光渐变（specular rim），`mix-blend-mode: screen`。
- `::after` 伪元素：内描边 + 24px 内辉光（caustic sheen）。

#### 材质变体（全部预定义，直接用）

| class | 用途 | 关键差异 |
|-------|------|---------|
| `.liquid-glass` | 默认面板 | 上面完整定义 |
| `.liquid-glass-hover:hover` | 可悬浮卡片 | `translateY(-2px) scale(1.005)` + emerald 辉光 `0 0 30px rgba(34,197,94,0.08)` |
| `.liquid-glass-active` | 激活态（导航选中）| emerald 渐变填充 + `0 0 28px rgba(34,197,94,0.18)` |
| `.liquid-pill` | 胶囊（搜索/筛选/头像条）| blur 24px + `radius:999px` |
| `.liquid-icon-well` | 图标井（圆形图标容器）| 145° 渐变 + blur 16px |
| `.liquid-input` | 输入框 | 黑底 `rgba(0,0,0,0.35)` + blur 20px；focus 变 emerald 描边 + `0 0 0 3px rgba(34,197,94,0.12)` |
| `.liquid-btn-primary` | 主按钮 | emerald 三段渐变 + 深绿字 `#04120c` + `0 0 24px rgba(16,185,129,0.35)` 辉光 |
| `.liquid-btn-ghost` | 幽灵按钮 | `rgba(255,255,255,0.04)` + blur 16px |
| `.frost-card` | CoverFlow 文档卡 | blur 28px + saturate 140% + 强高光 |
| `.frost-card-active` | CoverFlow 居中激活卡 | emerald 实色渐变 + `0 0 40px` 辉光 |

#### 环境背景 `.liquid-shell`（挂在最外层）

```css
.liquid-shell {
  background:
    radial-gradient(ellipse 60% 50% at 15% 20%, rgba(16,185,129,0.08), transparent 55%),
    radial-gradient(ellipse 50% 45% at 85% 15%, rgba(56,189,248,0.05), transparent 50%),
    radial-gradient(ellipse 45% 40% at 70% 85%, rgba(16,185,129,0.06), transparent 55%),
    radial-gradient(ellipse 40% 35% at 30% 75%, rgba(99,102,241,0.04), transparent 50%),
    #000;
}
/* ::before 叠加 3px 网点噪点，soft-light 混合，opacity 0.35 */
```

> 4 处径向光晕（emerald×2 / cyan×1 / indigo×1）让纯黑背景"活"起来，玻璃面板透过它能透出光。

### 3.4 组件原子库（真实 className 速查）

#### GlassCard / 面板容器
直接用 `<div className="liquid-glass p-4 sm:p-5">`，无需独立组件（项目也大量这样用）。可选 hover：加 `liquid-glass-hover`。

#### 按钮

```tsx
// 主按钮
<button className="liquid-btn-primary h-9 px-3.5 rounded-full text-[12px] font-bold">
  <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> 新增任务
</button>

// 幽灵/次按钮
<button className="liquid-btn-ghost h-10 px-4 rounded-full text-[12px] text-white/60">取消</button>

// 圆形图标按钮
<button className="liquid-btn-ghost w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white">
  <Bell className="w-4 h-4" />
</button>
```

- 默认高 **36px (h-9)**，大按钮 **40px (h-10)**，圆角全 `rounded-full`。
- 主按钮字色 `#04120c`（深绿黑），不是白色。

#### 输入框

```tsx
<input className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
```

#### 胶囊（搜索/筛选容器）

```tsx
<div className="liquid-pill flex items-center h-10 px-3.5 gap-2">
  <Search className="w-3.5 h-3.5 text-white/35" />
  <input className="flex-1 bg-transparent outline-none text-[12px] text-white/90 placeholder:text-white/30" />
</div>
```

#### StatusBadge（状态徽章）

```tsx
<StatusBadge type="priority" value="高" />   // emerald
<StatusBadge type="status" value="进行中" /> // emerald + pulse 点
<StatusBadge type="phase" value="产品设计" />// cyan
<StatusBadge type="tag" value="Figma" />     // slate
```

#### LiquidSelect（自定义下拉，**禁用原生 select**）

```tsx
<LiquidSelect
  variant="pill"          // 'pill' 紧凑筛选 | 'field' 表单
  placement="bottom"      // 'top' 底栏场景向上展开
  value={statusFilter}
  onChange={setStatusFilter}
  options={[{ value: '进行中', label: '进行中' }, ...]}
/>
```

- 通过 `createPortal` 挂到 `document.body`，自适应上下展开，弹簧动效。

#### LiquidModal（统一二级弹窗）

```tsx
<LiquidModal
  open={open}
  onClose={...}
  title="新建工作区"
  subtitle="为团队开辟独立协作空间"
  icon={<Plus className="w-5 h-5" />}
  widthClass="max-w-lg"
  footer={<div className="flex justify-end gap-2">...</div>}
>
  {children}
</LiquidModal>
```

- 遮罩 `bg-black/72` + `backdrop-filter: blur(20px)`。
- 面板 spring（stiffness 360, damping 26）缩放上浮 + `blur(12px)→0`。
- 顶部一条 emerald 渐变光线（`via-emerald-300/70`），右上角辉光斑。
- ESC 关闭，点遮罩关闭。

#### Toast（轻提示）

```tsx
const { show, ToastEl } = useToast();
show('已切换工作区');
```

底部右侧浮现，emerald 半透明 + blur。

### 3.5 图标规范

- **库**：`lucide-react`，线性，`strokeWidth={1.6–1.75}`（细线）。
- **尺寸**：导航/标题 `15px`，按钮 `3.5–4 (14–16px)`，标题旁 `4–5 (16–20px)`。
- **颜色**：默认 `text-white/40`，激活 `text-emerald-300`，hover `text-white`。
- **常用图标映射**：
  - 任务管理 `Target`，项目总览 `BarChart3`，文件 `FileText`，日程 `Calendar`，团队 `Users`，智能分析 `Sparkles`（带 AI badge），知识库 `BookOpen`，设置 `Settings`。

---

## 4. 框架布局规范

> 全部用 CSS Grid + clamp 流体自适应，**无固定 max-width 居中**，左右随视口拉满。

### 4.1 整体三段

```
┌─────────────────────────────────────────────────────┐
│                   liquid-shell (#000 + 光晕)          │
│  ┌──────────┐ ┌──────────────────────────────────┐  │
│  │ Sidebar  │ │  TopBar (标题+搜索+通知+新增)     │  │
│  │ (悬浮玻璃) │ ├──────────────────────────────────┤  │
│  │          │ │                                    │  │
│  │ 导航 8 项 │ │     Main (RouteTransition)         │  │
│  │          │ │     各页内容                        │  │
│  │ 工作区    │ │                                    │  │
│  │ 用户卡片  │ │                                    │  │
│  └──────────┘ └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4.2 `.app-frame`（主壳）

```css
.app-frame {
  display: grid;
  grid-template-columns: clamp(176px, 14vw, 280px) minmax(0, 1fr);
  column-gap: clamp(10px, 1.2vw, 20px);
  padding: clamp(8px, 1.2vw, 18px) clamp(10px, 1.6vw, 24px);
  height: 100%; width: 100%; max-width: none;
}
```

- 侧栏 `clamp(176→280px)`，主区 `1fr` 吃满。
- **空白 void 保留在组件内部 padding，不靠砍左右边距**。

### 4.3 任务管理首页 `.tasks-frame`（截图主视觉）

```
┌─────────────────────────────┬───────────────┐
│  tasks-left (同高拉伸)       │  tasks-right  │
│  ┌─────────────────────┐    │  (智能详情通高) │
│  │  KPI 行 (4 卡等宽)   │    │               │
│  ├──────────┬──────────┤    │  AISmartDetail│
│  │ 任务看板  │ CoverFlow│    │  Panel        │
│  │ (分组手风琴)│ (3D卡片堆)│    │  (内容滚动)    │
│  ├──────────┴──────────┤    │               │
│  │  ProjectTimeline 贴底 │    │  ───────────  │
│  │  (mt-auto)           │    │  底部操作条贴底 │
│  └─────────────────────┘    │  (与时间线对齐) │
└─────────────────────────────┴───────────────┘
```

```css
.tasks-frame {
  display: grid;
  grid-template-columns: minmax(0,1fr) clamp(260px, 24vw, 400px);
  align-items: stretch;
}
.board-deck-row {
  display: grid;
  grid-template-columns: minmax(280px, 1.05fr) minmax(240px, 1fr);
}
```

> ★ **对齐铁律**：右侧详情的底部操作条 (`mt-auto`)，与左侧时间线 (`timeline-slot { margin-top:auto }`) 的下沿**视觉对齐**。

---

## 5. 动效系统（`lib/motion.ts`）

> **没有动效 = 不合格**。所有 token 已预置，直接引用。

### 5.1 弹簧 / 缓动 Token

```ts
export const springSoft  = { type:'spring', stiffness:320, damping:28, mass:0.85 };
export const springSnappy= { type:'spring', stiffness:420, damping:26, mass:0.7  };
export const easeOutExpo = [0.22, 1, 0.36, 1];
```

### 5.2 Variants 速查

| Variant | 用途 | 关键帧 |
|---------|------|--------|
| `pageVariants` | 页面基础切换 | opacity + y:18 + scale:0.985 + blur:10px → 0 |
| `pageSlideVariants(dir)` | **侧栏 8 页带方向** | x: ±28 + blur:8px，exit x:∓22 |
| `viewVariants` | 页内 Tab/视图 | y:12 + blur:6px |
| `titleVariants` | 顶栏标题交叉淡入 | y:8 + blur:4px |
| `listItemVariants` | 列表项 stagger | x:-8，delay: i*0.035 |
| `popVariants` | 弹出元素 | scale:0.92 + y:10，springSoft |
| `staggerContainer/Item` | 容器错落入场 | staggerChildren:0.05 |

### 5.3 过渡组件（`PageTransition.tsx`）

| 组件 | 用途 |
|------|------|
| `RouteTransition` | 主导航 8 页切换（`mode="wait"` + direction） |
| `ViewTransition` | 日/周/月、设置 Tab、分析周期（横向滑 + blur） |
| `TitleTransition` | 顶栏标题 |

### 5.4 `layoutId` 滑块（共享元素动画）

- 导航激活：`layoutId="nav-liquid"`（emerald 玻璃激活块在菜单项间滑动）。
- 任务选中：`layoutId="task-selected-bar"`（左侧 emerald 竖条）。
- 筛选 pill：`layoutId="task-filter-pill"`。

### 5.5 其它 CSS 动画

- `.stagger-children > *` —— `riseIn` 错落入场（nth-child 延迟 0.02→0.22s）。
- `.animate-pulse-glow` —— `pulseGlow` 4.5s 状态点呼吸。
- `.liquid-shimmer` —— shimmer 4.5s 流光。
- KPI 数字变化用 `motion.span key={count}` 触发重渲染淡入。
- confetti —— `addTask` / `completeTask` 时触发（可在设置关闭）。

---

## 6. 页面要求（8 大模块逐页）

> 导航顺序（`TAB_ORDER`）：任务管理 → 项目总览 → 文件归档 → 日程管理 → 团队协作 → 智能分析 → 知识库 → 设置中心。切换方向由 `indexOf` 差值决定。

### 6.1 任务管理（tasks · 默认首页 · 截图主视觉）

**页面标题**：任务管理 / 高效规划 · 智能协同 · 结果驱动

**布局**：`.tasks-frame` 左右同高（见 §4.3）。

**左栏 tasks-left（从上到下）**：

1. **KPI 行**（`KPICardsRow`）：4 张等宽玻璃卡，`min-h-[88px]`：
   - 今日待办 12（↑20% emerald）· ClipboardList
   - 进行中 28（↑8%）· Activity
   - 已完成 56+已完成数（↑15%）· CheckCircle2
   - 逾期任务 3（↓40% rose + 红辉光）· AlertCircle
   - 每卡：标题(12px/0.45) + 大数字(28px/800/tabular-nums) + 单位(11px) + 趋势 + 右侧图标井(44px，hover 旋转)。
   - 点击卡 → `LiquidModal` 列出对应任务，点击任务定位到智能详情。

2. **看板 + CoverFlow 行**（`.board-deck-row`）：
   - **任务看板**（`TaskGroupList`）：
     - 顶栏：「任务看板」+ `{tasks.length} active`。
     - 筛选条（**单行 flex-nowrap**）：pill 组 [全部任务/我负责的/我参与的]（layoutId 滑块）+ 状态 `LiquidSelect` + 排序按钮（优先级/时间切换）+ 添加按钮。
     - 按阶段分组手风琴：**需求评审(emerald) / 产品设计(cyan/sky) / 开发实现(purple/violet)**，每组：色点 + 名称 + 数量徽章 + 折叠箭头。
     - 任务行：选中 emerald 竖条(layoutId) + ID(mono/0.3) + 标题 + 优先级徽章 + 时间(mono)。hover `x:2`。
   - **CoverFlow 卡片堆**（`CoverFlowDeck`）：3D 堆叠文档卡，居中卡 `frost-card-active`(emerald)，每卡右下角 Play，滚轮切换，右上角页码小点，**底部无细条**。

3. **项目时间线**（`ProjectTimeline`，`timeline-slot mt-auto` 贴底）：周/双周/月切换 + 今天按钮 + 横向条形图，点击条联动详情。

**右栏 tasks-right（`AISmartDetailPanel` 通高）**：
- 头部：Sparkles + 「智能详情」+ 搜索圆钮。
- 任务 ID(mono/0.35) + 标题(18px/700) + 优先级胶囊。
- 描述（白/0.03 底圆角框）。
- Meta 行：负责人(头像井) / 所属项目(ShieldCheck emerald) / 截止时间(mono) / 当前状态(emerald pulse 点) / 优先级(rose 点) / 标签(+号编辑)。
- **AI 助手建议**框：黑底 + emerald 辉光斑 + 建议列表 + 「查看建议详情」→ LiquidModal（含置信度%）。
- **底部操作条（mt-auto 贴底）**：编辑任务(ghost flex-1) + 完成任务(primary flex-[1.35]，完成触发 confetti) + 更多(⋯ 菜单：复制ID/编辑/标记延期)。

### 6.2 项目总览（overview）

标题：项目总览 / 全景里程碑 · 研发健康度与进度跟进。
要求：健康度/风险/团队 **Tab 动效切换**（`ViewTransition`）；模块下钻；项目卡片矩阵。

### 6.3 文件归档（files）

标题：文件归档 / 归档沉淀 · 多维搜索与历史版本可溯。
要求：分类(产品文档/设计规范/技术文档…) + 搜索 + 上传(`addFile`) + 预览(`DocPreviewModal`) + 下载/重命名/分享/删除，全部闭环。

### 6.4 日程管理（schedule）

标题：日程管理 / 智能日历 · 会议排期与冲突预警。
要求：**月/周/日三视图强切换动效**；预约/编辑/删除走 `LiquidModal`；今天按钮；优先级筛选；空白格点击预约；右栏日程列表随日期切换带动效。全高布局。

### 6.5 团队协作（collaboration）

标题：团队协作 / 实时矩阵 · 成员负载与任务指派。
要求：成员矩阵卡片；邀请成员；站内消息；邮件（`LiquidModal`）。

### 6.6 智能分析（analytics）

标题：智能分析 / AI 效能推演 · 链路瓶颈与风险评估。导航有 **AI badge**（emerald）。
要求：周期切换动效；KPI；效率建议；风险跟踪；漏斗图；成员绩效。下钻/导出/重算闭环。

### 6.7 知识库（knowledge）

标题：知识库 / 沉淀最佳实践 · 团队 SOP 规格标准。
要求：搜索 + 分类 + 发布 + 收藏 + 分享。

### 6.8 设置中心（settings）

标题：设置中心 / 自定义液态玻璃视觉与协同偏好。
要求：**六分类填满**（外观 / AI / 通知 / 账号 / 安全 / 系统）；**主题色 emerald/cyan/purple 切换真实改 CSS 变量**；**玻璃 blur 强度 standard/ultra/max 改 `--blur-liquid`**；confetti 开关；恢复默认；保存反馈。

---

## 7. 数据模型（TypeScript）

> 取自 `types/index.ts` + `AppContext.tsx` 初始数据，复刻时直接用。

```ts
export type NavTab = 'tasks'|'overview'|'files'|'schedule'|'collaboration'|'analytics'|'knowledge'|'settings';
export type Priority = '高'|'中'|'低'|'高优先级'|'紧急';
export type TaskStatus = '进行中'|'已完成'|'待处理'|'已延期';

export interface TaskItem {
  id: string;              // "WXB-2025-001"
  title: string;
  priority: Priority;
  status: TaskStatus;
  time: string;            // "今天 10:00"
  phase: '需求评审'|'产品设计'|'开发实现'|'测试验证';
  assignee: { name: string; avatar: string; role: string }; // avatar="BR"
  project: string;
  deadline: string;        // "2025-05-24 18:00"
  description: string;
  tags: string[];
  aiSuggestions?: string[];
  completionProgress?: number; // 0-100
}

export interface FileDoc { id; title; category; size; author; updatedAt; completion?; tags[] }
export interface CardDeckItem { id; title; quarter; completionRate; type; colorTheme:'emerald'|'glass'; details; author; updatedAt }
export interface TimelineRow { id; phase; taskTitle; startDate; endDate; startDay; endDay; status; highlighted? }
```

**全局状态 `AppContext`**：`tasks / selectedTask / addTask / updateTask / completeTask / deleteTask` · `workspaces / currentWorkspace` · `files / addFile` · `accentColor / glassBlur / enableConfetti` · `isNewTaskOpen / editingTask / selectedDoc`。

**示例任务**（6 条种子）：WXB-2025-001 需求评审会(高/进行中/Brandon) … 006 核心功能开发(高/待处理/David)。

---

## 8. 功能点清单

> 🔴 P0 必备 / 🟡 P1 重要 / 🟢 P2 增强

### 8.1 全局与导航

| # | 功能 | 描述 | 级 |
|---|------|------|----|
| G1 | 侧栏 8 项导航 | layoutId 激活滑块 + emerald 竖条 + 方向感知切换 | 🔴 |
| G2 | 工作区切换 | pill 下拉 4 个工作区，新建走 LiquidModal | 🔴 |
| G3 | 个人资料 | 弹窗编辑名称/职位/邮箱 + 退出 + 跳设置 | 🟡 |
| G4 | 顶栏标题动效 | TitleTransition 交叉淡入 | 🔴 |
| G5 | 全局搜索 | pill 搜索框，实时过滤任务(ID/标题)，结果下拉定位 | 🟡 |
| G6 | Cmd+K 快捷键提示 | 搜索框右侧 kbd 标识 | 🟢 |
| G7 | 通知铃铛 | 未读 emerald 红点 → NotificationsModal（**弹窗非下拉**） | 🔴 |
| G8 | 站内信 | LiquidModal 邮件列表 + 全部已读 | 🟡 |
| G9 | 新增菜单 | 下拉：新建任务/快速文档/预约日程 | 🔴 |
| G10 | Toast 反馈 | 底右轻提示 | 🟡 |

### 8.2 任务管理

| # | 功能 | 级 |
|---|------|----|
| T1 | KPI 4 卡（待办/进行中/已完成/逾期）+ 点击列表弹窗定位 | 🔴 |
| T2 | 任务分组看板（按阶段手风琴）+ 折叠 | 🔴 |
| T3 | 筛选（全部/我负责/我参与 + 状态 + 排序）单行 | 🔴 |
| T4 | 任务选中 emerald 竖条 + 联动右侧详情 | 🔴 |
| T5 | 新建任务（NewTaskModal）→ confetti | 🔴 |
| T6 | 编辑任务（EditTaskModal） | 🔴 |
| T7 | 完成任务 → confetti + 状态流转 | 🔴 |
| T8 | 删除任务 + 选中下移 | 🟡 |
| T9 | CoverFlow 3D 卡片堆 + 滚轮切换 + 每卡 Play | 🔴 |
| T10 | 文档预览（DocPreviewModal） | 🟡 |
| T11 | 项目时间线（周/双周/月 + 今天 + 联动） | 🟡 |
| T12 | 智能详情 AI 建议 + 详情弹窗（置信度） | 🟡 |
| T13 | 更多菜单（复制ID/编辑/标记延期） | 🟡 |

### 8.3 其它页（闭环要求）

| # | 功能 | 级 |
|---|------|----|
| P1 | 项目总览 Tab 动效 + 模块下钻 | 🟡 |
| P2 | 文件 CRUD（上传/预览/下载/重命名/分享/删除） | 🟡 |
| P3 | 日程月/周/日动效 + 预约/编辑/删除 + 筛选 | 🟡 |
| P4 | 团队成员矩阵 + 邀请 + 消息/邮件 | 🟡 |
| P5 | 智能分析周期切换 + KPI/建议/风险/漏斗/绩效 | 🟡 |
| P6 | 知识库搜索/分类/发布/收藏/分享 | 🟡 |
| P7 | 设置六分类 + 主题色/blur/confetti 真实生效 + 恢复默认 | 🔴 |

### 8.4 设计/工程级

| # | 功能 | 级 |
|---|------|----|
| E1 | 所有弹窗统一 LiquidModal | 🔴 |
| E2 | 所有下拉统一 LiquidSelect（禁原生 select） | 🔴 |
| E3 | 所有切换有 Framer Motion 动效 | 🔴 |
| E4 | 主题色/blur 实时改 CSS 变量 | 🟡 |
| E5 | 键盘 ESC 关弹窗、滚动/resize 下拉重定位 | 🟡 |

---

## 9. 交互与状态规范

- **Hover**：玻璃卡 `translateY(-2px) scale(1.005)` + emerald 微辉光；列表项 `x:2`；图标井旋转。
- **Tap**：`whileTap scale:0.92–0.96`。
- **聚焦**：输入框 emerald 描边 + `0 0 0 3px rgba(34,197,94,0.12)`。
- **激活**：导航 `liquid-glass-active`（emerald 渐变）+ layoutId 滑入。
- **空状态**：详情面板「选择左侧任务以查看智能详情」；列表「暂无任务」「当前列表为空」。
- **滚动条**：全局 5px 细条，透明轨道，thumb `rgba(255,255,255,0.12)`，hover 变 emerald；**CoverFlow deck 区完全隐藏滚动条**。
- **选中色**：`::selection` emerald 半透明。
- **彩屑**：创建/完成任务触发 `canvas-confetti`（particleCount 50–70, spread 60–70）。

---

## 10. 响应式断点

| 断点 | 表现 |
|------|------|
| **≥1600px** | 侧栏放宽 `clamp(220,12vw,300)`，详情栏 `clamp(320,22vw,440)`，主区继续吃满 |
| **1280–1599** | 标准三栏 |
| **≤1280** | 详情栏下沉，`.tasks-frame` 变单列，详情最小高 `min(520px,70vh)` |
| **≤1100** | 看板/CoverFlow 上下堆叠（`board-deck-row` 改 1fr 行） |
| **≤900** | 侧栏改顶置，`.app-frame` 单列；KPI 变 2 列 |
| **≤560** | padding 收 8px，KPI 单列 |

> 原则：**左右随视口自适应，禁止写死 1600 居中导致大屏两侧空一截外壳**。

---

## 11. 开发交付与自检清单

### 11.1 自检（`DESIGN.md §0.6` Agent 清单）

- [ ] 透过面板能看到背景光晕？有顶缘高光吗？
- [ ] 页面/视图/弹窗切换是否都有动效？
- [ ] 首页是否底对齐？看板筛选是否单行？CoverFlow 是否无底部细线？
- [ ] 播放钮是否在每张卡片右下角？滚轮能否切卡？
- [ ] 通知是否弹窗？所有二级弹窗是否 LiquidModal？
- [ ] 画布是否纯黑 `#000`（非深灰）？强调色是否仅 emerald？
- [ ] 所有下拉是否都用 LiquidSelect（无原生 select）？

### 11.2 Do / Don't

**Do**：纯黑 + 透玻璃 + 环境光；框架 padding + 底对齐 + 单行工具条；任何切换都有动效；弹窗统一 LiquidModal；CoverFlow 大卡 + 每卡 Play + 滚轮。

**Don't**：实心灰块/厚描边/彩虹强调色；顶栏通知下拉硬撑布局；瞬切无动画；面板互相遮挡/底部莫名细线；死按钮/半成品二级页；固定 max-width 居中。

### 11.3 交付物

- [ ] 上述 CSS 变量与 `.liquid-*` class 全部落地到 `index.css`
- [ ] `lib/motion.ts` 动效 token 完整
- [ ] 8 页 + 路由壳 + 方向切换
- [ ] LiquidModal / LiquidSelect / StatusBadge / Toast 原子库
- [ ] AppContext 状态 + 种子数据
- [ ] 主题色/blur/confetti 设置真实生效
- [ ] 响应式 5 档断点

### 11.4 部署

SPA，需静态主机 fallback 到 `index.html`（Nginx `try_files`），适配 Vercel / Netlify / Cloudflare Pages。

---

## 附录 A：复刻起步代码骨架

```tsx
// main.tsx
import { AppProvider } from '@/context/AppContext';
<AppProvider><App /></AppProvider>

// App.tsx 外层
<div className="w-full h-screen liquid-shell text-white overflow-hidden font-sans">
  <div className="app-frame relative z-10">
    <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
    <div className="main-stack min-h-0">
      <TopBar title={...} subtitle={...} titleKey={activeTab} />
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <RouteTransition routeKey={activeTab} direction={direction}
          className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden">
          {renderActivePage()}
        </RouteTransition>
      </main>
    </div>
  </div>
</div>
```

```css
/* index.css 头部 —— Tailwind v4 写法，无 config */
@import "tailwindcss";
@theme { /* 见 §3.1 所有 --color-*/ }
@layer base { body { background:#000; overflow:hidden; } }
/* + 全部 .liquid-* 材质 class + 框架布局 class */
```

---

*文档版本 v2.0 · 基于真实仓库 `github.com/lllll081926i/wenxibuddy`（master 分支）逆向 · 与项目 `DESIGN.md` 设计真源对齐*
