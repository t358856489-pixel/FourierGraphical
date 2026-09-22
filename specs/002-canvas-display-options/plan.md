# 实施计划: 画布显示选项

**分支**: `002-canvas-display-options` | **日期**: 2026-09-21 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/002-canvas-display-options/spec.md` 的功能规范

## 摘要

在已完成的傅立叶函数可视化编辑器上增加四个应用级的显示选项: 网格与坐标轴分开显示; 可自定义的画布背景色(线条配色自动适配);
轨迹淡化开关, 关闭后按可选的保留时长(5 秒到 10 分钟或"全部")保留轨迹, 最新 2 秒更亮并过渡到稳定的"正常亮度".

技术方法延续功能 001 的核心原则——**画面只由 `(函数, 时刻 t, 显示选项)` 决定**:

- 保留的轨迹不是逐帧累积的点列, 而是由纯函数 `planTrail` 算出的时间区间上的采样. 拖动时间轴、循环、改参数、导出视频因此自动正确.
- 长轨迹的成本用三件事压住: 周期性函数只采样一个周期(最常见的情形, 10 分钟的轨迹只需约 1 300 点); 非周期函数用 4 万点预算 + 按 2 的幂放大步长(网格稳定、缓存可复用); 稀疏采样时用二次曲线平滑.
- "正常亮度"用不透明的混色而不是透明度表达, 使反复重叠的轨迹不会越描越亮——这同时是"只采样一个周期"成立的前提.
- 任意背景色下的可辨识性由纯函数 `derivePalette` 保证, 并用性质测试在整个颜色空间上验证对比度下界; 默认背景时它原样返回现有主题, 保证默认画面逐像素不变.

## 技术背景

**语言/版本**: TypeScript 6 (strict), 目标 ES2022 —— 沿用功能 001
**主要依赖**: React 19、Zustand 5、Zod 4、原生 Canvas 2D —— **不新增依赖**
**存储**: 浏览器 IndexedDB 中的草稿(`draft.view` 增加四个字段); 已保存函数的格式不变
**测试**: Vitest 5 + React Testing Library + fast-check; Playwright + @axe-core/playwright; `pnpm test:perf` 基准
**目标平台**: 主流桌面与移动浏览器的当前版本
**项目类型**: 单一项目(纯前端), 在现有 `src/` 内增改
**性能目标**: 50 个分量、轨迹淡化关闭、"全部"、`t = 600` 时: 播放 60 fps(p95 帧间隔 < 25 ms); 每帧修改一次参数时 p95 < 100 ms (SC-004)
**约束条件**: 默认设置下的画面与本功能之前逐像素一致 (SC-007); 任意背景色下线条对比度 ≥ 3:1、文字 ≥ 4.5:1 (SC-003); 首屏 JS < 300 KB gzip; 章程 v1.0.0 全部原则
**规模/范围**: 3 个用户故事、29 条功能需求; 新增 3 个纯函数模块(约 300 行), 修改约 12 个现有文件; 新增 1 个界面面板

## 章程检查

*门控: 必须在阶段 0 研究前通过. 阶段 1 设计后重新检查.*

依据 `.specify/memory/constitution.md` v1.0.0.

| 原则 | 研究前 | 设计后 | 依据 |
|---|---|---|---|
| **I. 确定性优先** | 通过 | 通过 | 轨迹区间、步长、周期、配色都是纯函数(data-model "TrailPlan"、research R1/R4/R6); 明确否决了逐帧累积(R1). 缓存契约要求与整体重算逐点相等, 含步长放大的情形(contracts §4). 实时画面与导出共用 `drawFrame` 与 `derivePalette`(R11) |
| **II. 不可变数据与纯核心** | 通过 | 通过 | 新模块 `core/color`、`core/trailPlan` 无 DOM 依赖(颜色解析自带 OKLCH 转换而不借助画布, R6); 用户输入的颜色与读入的草稿都在边界校验(contracts §1、§6); `setBackground` 返回 `Result` |
| **III. 测试先行** | 通过 | 通过 | contracts 的每一行对应一个先失败的测试; 第一个任务是在未改动的代码上录制回归快照(R12); 对比度用性质测试 |
| **IV. 可访问性与键盘对等** | 通过 | 通过 | 全部新控件为原生表单控件(R10); 对比度下界是硬性契约; 新开关沿用已有的 `Toggle`, 不引入新的全局快捷键; axe 检查覆盖展开的面板 |
| **V. 性能预算** | 通过 | 通过 | 点数预算与周期收缩(R3、R4); 稳态每帧 ≤ 8 个新采样点(contracts §4); 基准先行并设明确判据(R8); 无新依赖, 包体影响可忽略 |
| **VI. 简单与本地优先** | 通过 | 通过 | 不改函数的持久化格式, 不引入草稿版本迁移机制(R9); 离屏分层缓存与拖动期 LOD 均**未采用**, 只作为有条件的后备记录在案(R3、R8) |
| 附加约束 · 设计质量 | 通过 | 通过 | 颜色经设计令牌与派生函数取得, 不在组件里硬编码; "画面"面板沿用仪器面板的视觉语言 |
| 附加约束 · 安全 | 通过 | 通过 | 用户输入的颜色只接受 `^#[0-9a-f]{3,6}$` 的十六进制, 规范化后才进入状态与存储; 不涉及 `innerHTML` 或网络请求 |

无违规. 两个后备方案(R3 的 LOD、R8 的分块离屏层)若将来启用, 会触及原则 I 与 VI, **必须**先补入下方"复杂度跟踪"并说明基准数据.

## 项目结构

### 文档(此功能)

```
specs/002-canvas-display-options/
├── plan.md              # 本文件
├── research.md          # 阶段 0: 12 项设计决策
├── data-model.md        # 阶段 1: ViewSettings 扩展、TrailPlan、配色派生、旧草稿兼容
├── quickstart.md        # 阶段 1: 开发顺序与逐故事验收清单
├── contracts/
│   └── display-api.md   # 模块接口与契约测试表
├── checklists/requirements.md
└── tasks.md             # 阶段 2 (/speckit.tasks 生成)
```

### 源代码(仓库根目录)

在功能 001 的结构内增改, 不新增顶层目录. `+` 为新增, `~` 为修改.

```
src/
├── core/
│   ├── + color.ts               # parseColor / parseUserColor / mix / relativeLuminance / contrastRatio
│   ├── + trailPlan.ts           # periodOf / planTrail
│   ├── ~ types.ts               # ViewSettings 新字段, TrailRetention, TrailPlan
│   ├── ~ ranges.ts              # 保留时长档位、预算、高亮时长、对比度阈值、预置背景色
│   ├── ~ evaluator.ts           # sampleTrailPlan; 旧 sampleTrail 委托给它
│   └── ~ schema.ts              # draft.view 先补默认值再严格校验
├── render/
│   ├── + palette.ts             # derivePalette
│   ├── ~ theme.ts               # RenderTheme 增加 traceNormal
│   ├── ~ drawGrid.ts            # { grid, axes, verticals }
│   ├── ~ drawEpicycles.ts       # + drawRetainedPolyline (不用 globalAlpha, 稀疏时用二次曲线)
│   ├── ~ drawWaveform.ts        # 基准线随 axes, 刻度线随 grid, 保留模式的亮度规则
│   ├── ~ drawFrame.ts           # 用 planTrail 决定轨迹; 签名不变
│   └── ~ trailCache.ts          # 以 TrailPlan 为键; 步长放大时复用偶数下标
├── state/
│   └── ~ viewStore.ts           # showAxes / trailFade / trailRetention / background 及其动作
├── features/
│   ├── stage/
│   │   ├── ~ StageToolbar.tsx   # 增加"坐标轴"开关与"画面"按钮
│   │   └── ~ useStageLoop.ts    # 主题经 derivePalette; 背景变化时重绘
│   ├── + display-panel/         # "画面"面板
│   │   ├── DisplayPanel.tsx     # 轨迹淡化、保留时长、状态说明
│   │   ├── BackgroundPicker.tsx # 预置色块、取色器、十六进制输入、恢复默认
│   │   └── display-panel.css
│   └── export-dialog/
│       └── ~ ExportDialog.tsx   # frameInput 的 theme 经 derivePalette
tests/
├── e2e/  + us6-trail-retention.spec.ts  + us7-grid-axes.spec.ts  + us8-background.spec.ts  ~ a11y.spec.ts
├── perf/ ~ render-benchmark.spec.ts     # 三个 t = 600 场景
└── fixtures/ + draft-v001-grid-on.json  + draft-v001-grid-off.json
```

**结构决策**: 沿用功能 001 的单一项目、按功能组织的结构. 三个新的纯函数模块放在它们各自的层(`core/` 放无 DOM 的计算, `render/` 放与主题相关的派生),
界面集中在一个新的功能目录 `display-panel/`. 端到端测试文件按"故事 6–8"接着功能 001 的编号, 避免与已有的 `us1`–`us5` 混淆.

## 关键设计要点

| 需求 | 设计手段 | 详见 |
|---|---|---|
| FR-004 拖动 / 播放 / 循环 / 导出的轨迹一致 | 轨迹区间是 `(fn, t, view)` 的纯函数, 不累积 | research R1, data-model "TrailPlan" |
| FR-002b 旧轨迹一律为正常亮度 | 不透明混色, 整个轨迹绘制期间 `globalAlpha = 1` | research R2, contracts §5 |
| SC-004 10 分钟轨迹仍 60 fps、编辑 < 100 ms | 周期收缩 + 4 万点预算 + 2 的幂步长 + 增量缓存 | research R3–R5 |
| FR-008 不得有可见的折线化 | 每圈采样 < 16 时改用二次曲线; < 8 时提示"已简化显示" | research R3 |
| FR-018 / FR-019 / SC-003 任意背景色下可辨识 | `derivePalette` 二分调整到对比度下界, 性质测试覆盖颜色空间 | research R6, contracts §2 |
| SC-007 默认画面逐像素不变 | 默认背景时原样返回主题; 淡化开启时的绘制代码不动; 先录制回归快照 | research R12, contracts §5 |
| FR-024 / SC-006 旧草稿不丢失 | `draft.view` 先补默认值(坐标轴沿用旧的网格状态)再严格校验 | research R9, data-model "持久化" |
| FR-023a 不改变已保存的函数 | 新字段只进 `ViewSettings`; 函数 schema 零改动并有测试守护 | contracts §6、§7 |
| FR-022 导出与画面一致 | 导出与舞台循环用同一个 `drawFrame` 与 `derivePalette` | research R11 |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 每帧描 4 万点折线超出帧预算(非周期函数 + 长保留) | SC-004 | 基准先行(R8 场景 b); 不达标时启用分块离屏层后备, 其确定性分析已在 R8 完成; 启用前补"复杂度跟踪" |
| 拖动参数时整体重算 4 万点, 低端设备上发涩 | 手感(功能 001 已知弱项的放大) | 周期函数不受影响; 非周期时桌面约 30–50 ms, 仍在 100 ms 内; LOD 后备仅在基准不达标时考虑 |
| OKLCH→sRGB 的自实现与浏览器的转换有偏差 | 派生配色与令牌颜色不一致 | 契约要求每通道偏差 ≤ 1; 端到端测试在真实浏览器里比对令牌颜色 |
| 步长放大的瞬间轨迹形状有可察觉的变化 | 观感 | 新网格是旧网格的子集, 保留下来的点位置不变; 配合二次曲线平滑. 在 quickstart 清单里目测确认 |
| "画面"面板使工具栏在窄屏下更拥挤 | FR-026(功能 001) | 只有两个高频开关留在工具栏; 沿用现有的响应式断言并加上展开面板的状态 |

## 复杂度跟踪

无违规, 无需填写.
