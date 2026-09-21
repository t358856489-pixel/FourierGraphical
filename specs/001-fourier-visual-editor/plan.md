# 实施计划: 傅立叶函数可视化编辑器

**分支**: `001-fourier-visual-editor` | **日期**: 2026-09-21 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/001-fourier-visual-editor/spec.md` 的功能规范

## 摘要

一个在浏览器中运行的纯前端单页应用: 用户用滑块、数值框和画布拖拽编辑一组旋转向量(谐波分量), 在"波形模式"和"二维绘图模式"下实时看到图形; 通过时间轴播放、跳转、循环; 为振幅/频率/相位设置关键帧让图形随时间变形; 把作品保存在浏览器本地, 并导出为 PNG 或 MP4.

技术方法的核心是**把全部图形定义为 `(函数, 时刻 t)` 的纯函数**: 向量角度用频率轨道的**闭式积分**求得(三种过渡方式的积分都有多项式闭式解, 见 [research R4](./research.md)), 轨迹是时间窗口上的采样而非逐帧累积. 由此, "拖动时间轴与连续播放结果一致"(FR-018f)、"循环回到起点状态正确"(FR-018g)、"切换模式重新生成轨迹"(FR-008a)、"视频与画面一致且不受设备性能影响"(FR-023b)四条最难的需求都由构造保证, 而不是靠状态同步维持. 同一个 `drawFrame` 纯函数服务于实时画布、图片导出和基于 WebCodecs 的离线逐帧视频导出.

## 技术背景

**语言/版本**: TypeScript 6 (strict), 目标 ES2022 (typescript-eslint 尚不支持 TS 7, 待其支持后升级)
**主要依赖**: React 19、Vite 8、Zustand 5(状态)、Zod 4(边界校验)、idb-keyval 6(IndexedDB)、Mediabunny 1.x(视频封装, 动态加载); 渲染用原生 Canvas 2D, 样式用原生 CSS + 设计令牌
**存储**: 浏览器 IndexedDB(已保存函数 + 自动保存的草稿); 无服务器、无网络请求
**测试**: Vitest 5 + React Testing Library + fast-check(性质测试) + fake-indexeddb; Playwright 1.6x + @axe-core/playwright(E2E、视觉回归、可访问性)
**目标平台**: 主流桌面与移动浏览器的当前版本(Chrome/Edge、Firefox、Safari); 视频导出需要 WebCodecs, 不支持时该入口禁用, 其余功能不受影响
**项目类型**: 单一项目(纯前端 Web 应用, 无后端)
**性能目标**: 50 个分量 + 10 条关键帧轨道时保持 60 fps(近三年手机不低于 30 fps 且无可见卡顿); 参数变化到画面更新 < 100 ms(目标为下一帧, 约 16 ms); 10 秒视频导出 ≤ 30 秒; LCP < 2.5 s、INP < 200 ms、CLS < 0.1
**约束条件**: 首屏 JS < 300 KB gzip、CSS < 50 KB; 严格 CSP 且无第三方脚本; 全部核心操作可仅用键盘完成; WCAG AA 对比度; 遵循 `prefers-reduced-motion`; 数据不可变; 单文件 < 800 行、单函数 < 50 行
**规模/范围**: 单人本地使用; 每个函数 ≤ 50 个分量、每个参数 ≤ 50 个关键帧(最坏约 7500 个关键帧 ≈ 300 KB); 5 个用户故事、约 40 条功能需求; 单屏应用, 约 6 个功能区(分量面板、画布舞台、播放控制、时间轴、预设、函数库/导出)

## 章程检查

*门控: 必须在阶段 0 研究前通过. 阶段 1 设计后重新检查.*

**现状**: 项目章程 v1.0.0 已于 2026-09-21 批准(本计划起草时章程尚为空模板, 当时以全局工程规则代替). 下表各行与章程原则的对应: 不可变数据 → II; 小文件/KISS → VI; 测试先行 → III; 错误处理与边界校验 → II; 性能预算 → V; 可访问性 → IV; 安全与设计质量 → 附加约束; 原则 I(确定性优先)由 research R4、R5 与"关键设计要点"保证.

| 门控 (来源) | 研究前 | 设计后 | 依据 |
|---|---|---|---|
| 不可变数据 (coding-style) | 通过 | 通过 | 所有实体只读; `core/` 纯函数返回新对象; 撤销基于快照 (data-model, R2) |
| 小文件、高内聚、按功能组织 (coding-style, web/coding-style) | 通过 | 通过 | `src/features/*` 按功能切分; `core/` 每个模块单一职责 |
| 测试先行, 覆盖率 ≥ 80%, 单元+集成+E2E (testing) | 通过 | 通过 | R11; 契约表逐条对应测试 (contracts/core-api.md) |
| 显式错误处理, 边界校验 (coding-style, security) | 通过 | 通过 | `Result<T>` + `ErrorCode`; 存储读取经 Zod 校验 (R8) |
| 研究与复用优先 (development-workflow) | 通过 | 通过 | 视频封装、存储、状态、校验均采用成熟库; 已核实 `mp4-muxer` 弃用并改用 Mediabunny (R6) |
| KISS / YAGNI | 通过 | 通过 | 无后端、无路由、无组件库、无 Worker(留有低成本迁移路径) |
| 性能预算与 Core Web Vitals (web/performance) | 通过 | 通过 | 画布绕过 React 渲染 (R3); 轨迹环形缓冲 (R5); Mediabunny 动态加载 (R6) |
| 可访问性 (web/testing) | 通过 | 通过 | 画布交互均有表单等价物; axe 自动检查 (R9) |
| 安全: CSP、无 `innerHTML`、无第三方脚本 (web/security) | 通过 | 通过 | R12 |
| 设计质量: 反模板化、明确风格方向 (web/design-quality) | 通过 | 通过 | "实验仪器 / 示波器"方向, 语义化分量配色 (R10) |

无违规, 复杂度跟踪表为空.

## 项目结构

### 文档(此功能)

```
specs/001-fourier-visual-editor/
├── plan.md              # 本文件
├── research.md          # 阶段 0: 13 项技术决策
├── data-model.md        # 阶段 1: 实体、状态转换、持久化布局
├── quickstart.md        # 阶段 1: 运行方式与逐故事验收清单
├── contracts/
│   ├── core-api.md                      # 模块接口与契约测试表
│   └── persisted-function.schema.json   # 持久化数据格式
├── checklists/requirements.md
└── tasks.md             # 阶段 2 (/speckit.tasks 生成, 非本命令)
```

### 源代码(仓库根目录)

```
src/
├── core/                        # 纯 TypeScript, 无 DOM 依赖, 覆盖率目标 ≥ 95%
│   ├── types.ts                 # 实体类型、Result、ErrorCode
│   ├── ranges.ts                # 各参数的取值范围常量 (research R13)
│   ├── keyframes.ts             # evaluate / integrate (闭式积分)
│   ├── tracks.ts                # 关键帧增删改移
│   ├── function.ts              # 分量与函数级编辑
│   ├── evaluator.ts             # vectorChain / tipAt / sampleTrail / boundingRadius
│   ├── playback.ts              # advance / seek / step / loop
│   ├── history.ts               # 撤销与重做
│   ├── presets.ts               # 方波 / 锯齿波 / 三角波
│   └── schema.ts                # Zod schema (对应 persisted-function.schema.json)
├── render/
│   ├── drawFrame.ts             # 唯一的绘制入口 (实时 / 图片 / 视频共用)
│   ├── drawEpicycles.ts
│   ├── drawWaveform.ts
│   ├── drawGrid.ts
│   ├── viewport.ts              # 世界坐标 ↔ 屏幕坐标, 自动缩放
│   └── theme.ts                 # 从 CSS 设计令牌解析 RenderTheme
├── state/
│   ├── documentStore.ts         # FourierFunction + History
│   ├── playbackStore.ts
│   ├── viewStore.ts
│   └── autosave.ts              # 防抖写入草稿
├── storage/
│   ├── FunctionRepository.ts    # 接口
│   ├── IndexedDbFunctionRepository.ts
│   └── InMemoryFunctionRepository.ts
├── export/
│   ├── exportImage.ts
│   ├── exportVideo.ts           # 离线逐帧渲染 + 背压 + 取消
│   └── videoSupport.ts          # H.264 编码能力检测
├── features/
│   ├── stage/                   # 画布舞台: rAF 循环、指针拖拽向量、缩放平移
│   ├── components-panel/        # 分量列表、参数控件、输入校验
│   ├── transport/               # 播放 / 暂停 / 重置 / 速度 / 时间读数 / 循环区间
│   ├── timeline/                # 时间轴、关键帧标记、过渡方式
│   ├── presets/                 # 预设选择与覆盖确认
│   ├── library/                 # "我的函数"列表: 保存 / 打开 / 重命名 / 删除
│   └── export-dialog/           # 图片与视频导出、进度、取消
├── ui/                          # 通用控件: Slider、NumberField、Toggle、Dialog、Toast
├── hooks/                       # useReducedMotion、useKeyboardShortcuts、useAnimationFrame
├── styles/                      # tokens.css、typography.css、global.css
├── App.tsx
└── main.tsx

tests/
├── e2e/                         # 每个用户故事一条 Playwright 流程 + a11y
├── visual/                      # 320 / 768 / 1024 / 1440 截图基线
└── fixtures/                    # 示例函数、损坏数据样本

index.html                       # CSP 由 vite.config.ts 的插件仅在生产构建时注入; 字体经 @fontsource 自托管
```

单元测试、组件测试与被测文件同目录放置(`*.test.ts(x)`); 仓储契约测试在 `src/storage/` 下对两个实现各跑一遍.

**结构决策**: 采用单一项目结构. 规范确认无后端(FR-027 与假设章节), 因此模板中的"前端 + 后端"与"移动端 + API"选项不适用. 在模板的 `src/` 之下按**功能**而非文件类型组织(遵循全局 web 规则), 并把全部数学与领域逻辑隔离在无 DOM 的 `src/core/` 中——这是满足 TDD 与 80% 覆盖率门槛成本最低的方式, 也让 `render/` 与 `export/` 能够共享同一套确定性求值.

## 关键设计要点

| 需求 | 设计手段 | 详见 |
|---|---|---|
| FR-018f 变频率旋转连续、拖动与播放一致 | 频率轨道闭式积分, `θ(t)` 无状态 | research R4 |
| FR-018g 循环回起点状态正确 | 同上——状态只由 `t` 决定, 无需额外逻辑 | data-model "推进规则" |
| FR-008a 切换模式重新生成轨迹 | 轨迹是时间窗口上的纯函数采样 | research R5 |
| FR-023b 视频流畅度与设备性能无关 | WebCodecs 离线逐帧编码, 复用 `drawFrame` | research R6 |
| FR-018e 手动改值自动打关键帧 | `ParamTrack` 可辨识联合 + `setValueAt` 状态转换表 | data-model, contracts §2 |
| FR-006 一次拖拽 = 一步撤销 | 拖拽中只更新 present, pointer-up 时 `commit` | research R2 |
| SC-002 / SC-003 | 画布由 rAF 直接订阅 store, 不经 React; 轨迹环形缓冲 | research R3, R5 |
| FR-024 键盘可完成全部操作 | 每个画布交互都有表单等价物; 关键帧标记为可聚焦按钮 | research R9 |
| 边界情况: 存储不可用 / 数据损坏 | 仓储永不抛异常, 返回 `Result`; 读取经 schema 校验 | contracts §7 |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 手机上整体重算轨迹(编辑、拖动时间轴时)超出帧预算 | SC-003 | 点数上限 4000 并按设备自适应降低; 先做基准测试再决定是否需要 Worker |
| Safari / Firefox 的 WebCodecs H.264 编码配置差异 | FR-023d | `isConfigSupported` 探测 H.264; 不支持时禁用入口并说明原因(不提供 WebM 回退, FR-023d); E2E 在三个引擎上跑导出冒烟测试 |
| 范围较大(双模式 + 关键帧 + 视频导出) | 交付周期 | 严格按 P1→P5 交付; P1+P2 构成可发布的 MVP, 每个故事可独立验收 |
| 时间轴在"无限时间 + 关键帧 + 循环区间"下的交互复杂 | 故事 2/3 的可用性 (SC-006) | 时间轴范围规则已在 data-model 明确; 实施时先做可交互原型并用 quickstart 清单走查 |
| 高频分量的视觉混叠被误认为 bug | 用户信任 | 已记入 quickstart"已知限制"; 频率 > 30 时在控件旁给出提示 |

## 复杂度跟踪

无违规, 无需填写.
