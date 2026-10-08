# 实施计划: 从图形得到傅立叶函数

**分支**: `003-shape-to-fourier` | **日期**: 2026-09-24 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/003-shape-to-fourier/spec.md` 的功能规范

## 摘要

让用户先给出图形——从内置图形库选择(雪花等 8 个)、在画布上手绘、或导入 SVG——系统把闭合路径做离散傅立叶变换,
取贡献最大的若干项作为谐波分量装进编辑器, 旋转向量在二维绘图模式下把图形一笔画出. 生成的函数与手工搭建的没有任何区别.
分量上限从 50 提高到 200, 采样预算按分量数自适应以保持性能.

## 技术背景

**语言/版本**: TypeScript 6 (strict) —— 沿用
**主要依赖**: 不新增. SVG 用浏览器内置 `DOMParser` 解析; DFT、路径处理、`d` 属性解析器均自写(合计约 500 行纯函数)
**存储**: 无变化; 函数格式不变, 仅 `MAX_COMPONENTS` 常量 50 → 200
**测试**: Vitest + fast-check(重建误差、平滑拓扑的性质测试); Playwright 三个故事 + 200 分量基准
**目标平台**: 沿用; 手绘依赖指针事件(鼠标、触摸、触控笔)
**项目类型**: 单一项目, 新增 `src/core/shape/` 与 `src/features/shapes/`
**性能目标**: 转换 ≤ 1 s(2000 点手绘 / 5000 点 SVG, 实际预计 < 50 ms); 手绘松手到开始描绘 < 0.3 s; 200 分量下 60 fps, 编辑响应 < 100 ms
**约束条件**: 章程全部原则; 导入只在本地解析且不得执行脚本或发起网络请求; 默认画面回归快照不变
**规模/范围**: 3 个故事、24 条 FR; 8 个内置图形; 新增约 5 个核心模块、1 个对话框、1 个舞台绘制层

## 章程检查

依据章程 v1.0.0.

| 原则 | 研究前 | 设计后 | 依据 |
|---|---|---|---|
| I 确定性 | 通过 | 通过 | 转换是纯函数; 生成的分量进入既有求值路径, 画面仍只由 (函数, t, 选项) 决定. 绘制中的笔迹是独立的覆盖层, 不进入 `drawFrame` |
| II 纯核心 / 边界校验 | 通过 | 通过 | `core/shape/*` 无 DOM(仅 `svg.ts` 用 `DOMParser`, 放在 `src/features/shapes/importSvg.ts` 边界层, `core` 只解析 `d` 字符串); 外部文件全部经 `Result` 校验, 大小与点数设限 (R6) |
| III 测试先行 | 通过 | 通过 | contracts 每行对应先失败的测试; 性质测试覆盖重建与平滑 |
| IV 可访问性 | 通过 | 通过 | 图形库与导入完全可键盘操作; 手绘本身无键盘等价(规范故事 2 场景 6 明确接受), 但同一结果可经图形库/导入获得 |
| V 性能预算 | 通过 | 通过 | 上限提高的同时把采样预算改为按分量数自适应, 总求值量不变 (R3); 面板虚拟化; 基准新增 200 分量场景 |
| VI 简单 / 本地 | 通过 | 通过 | 无新依赖、无网络; 不引入 FFT 库(规模不需要); Worker 只作后备 |
| 附加约束 · 安全 | 通过 | 通过 | `DOMParser` 独立文档不执行脚本、不加载外部资源; 有测试监听网络请求为零 (contracts §4) |

无违规. 分量面板虚拟化是为原则 V 增加的新机制(约 80 行), 不是投机性抽象, 不需记入复杂度跟踪.

## 项目结构

```
src/core/shape/            + spectrum.ts  + builtins.ts  + drawing.ts  + pathData.ts  (d 属性解析, 纯字符串)
src/core/ranges.ts         ~ MAX_COMPONENTS=200, 新常量, 预算改为按分量数计算
src/core/trailPlan.ts      ~ 点数预算读取 TRAIL_EVALUATION_BUDGET / 启用分量数
src/state/documentStore.ts ~ applyGenerated
src/state/drawingStore.ts  + DrawingSession
src/features/shapes/       + ShapeDialog.tsx (三页签)  + ShapeLibrary.tsx  + ImportPanel.tsx  + importSvg.ts (DOMParser 边界层)  + useOverwriteGuard.ts
src/features/stage/        + DrawingLayer.tsx (笔迹、按钮、平滑/分量滑块)  ~ useStagePointer.ts (绘制模式下让出)
src/features/components-panel/ ~ ComponentsPanel.tsx (虚拟化列表; "图形"入口)
tests/e2e/                 + shapes.spec.ts;  tests/perf ~ 200 分量场景;  tests/fixtures/ + svg 样本(含畸形与含脚本的)
```

**结构决策**: 沿用按功能组织; 数学放 `core/shape/`, 唯一需要 DOM 的 SVG 解析放在 features 的边界层, 使 `core` 保持可性质测试.

## 关键设计要点

| 需求 | 手段 | 详见 |
|---|---|---|
| FR-001–004 路径→分量 | 等弧长重采样 + DFT, 按振幅取前 count 项, 含负频率 | research R1 |
| FR-005 尺寸与居中 | 去直流项 + 长边归一到 2 + y 翻转 | R2 |
| FR-002a 上限 200 且不掉帧 | 采样预算 ÷ 分量数; 面板虚拟化; 基准 | R3 |
| FR-014a/b 可调平滑 | 原始点列保留, 每次从原始点重做重采样→平滑→DFT | R5 |
| FR-017 安全导入 | DOMParser 独立文档 + 自写 d 解析 + 大小/点数上限 | R6 |
| FR-006/007/007a 应用 | 复用 applyEdit/reset/play/viewStore 动作 | R7 |

## 风险

| 风险 | 缓解 |
|---|---|
| 200 分量 × 保留轨迹的每帧描线与编辑重算超预算 | 预算自适应已在设计中; 基准先行; 不达标再考虑 Worker(需记入复杂度跟踪) |
| 分量面板 200 行卡顿 | 虚拟化; 组件测试断言可视区外的行不渲染 |
| SVG 变体多(变换、单位、viewBox) | 只承诺 FR-016 列出的子集, 其余明确告知; 畸形输入全部走 Result |
| Koch 雪花 3 阶的尖角在 200 项下仍被磨平 | 契约要求 1% Hausdorff; 若不达标, 降到 2 阶(6·16 边)并在 research 记录 |

## 复杂度跟踪

无.
