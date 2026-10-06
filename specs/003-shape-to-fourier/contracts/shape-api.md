# 契约: 图形到函数

约定同功能 001/002: `src/core/` 纯函数、`Result<T>`、不可变. 每行契约先有失败测试.

## 1. `core/shape/spectrum`
```ts
resample(path: ShapePath, n: number): ShapePath                     // 等弧长, 闭合
normalize(path: ShapePath): ShapePath                               // 重心为原点, 长边 = SHAPE_TARGET_EXTENT; 不翻转(输入已是世界坐标)
analyze(path: ShapePath): ShapeSpectrum                             // DFT, 不含 n=0, 按振幅降序
reconstruct(spectrum: ShapeSpectrum, count: number, samples: number): ShapePath
toComponents(spectrum, count, idFactory?): readonly HarmonicComponent[]
```
| 契约 | 需求 |
|---|---|
| 圆 → 第一项振幅 ≈ 半径, `n = ±1`(方向随绕行方向), 其余项 < 1e-6 | R1 |
| 正 n 边形 → 非零项只出现在 `n ≡ 1 (mod n边)` 的频率上 | R1 |
| 任意闭合点列: `reconstruct(analyze(p), 全部, N)` 与 `normalize(resample(p, N))` 逐点相差 < 1e-6 (fast-check) | FR-003 |
| 内置图形以 200 项重建, 到原路径的 Hausdorff 距离 < 1% 尺寸; 60 项 < 3% | FR-003, SC-002 |
| `toComponents` 的频率为 `n·0.2`, 相位量化到 0.1°, 振幅到 0.001, 丢弃 < 1e-4; `count` 超过项数时取全部 | R2, FR-004 |
| 生成分量的频率绝对值 ≤ `FREQUENCY_RANGE.max`(`analyze` 只保留 `|n| ≤ 500` 的项); 对含极细锯齿的随机路径亦然 (fast-check) | FR-008, 分析 F1 |
| 心形以内置 `path()` 直接转换后, 重建曲线的尖端在下方(y 最小处), 不倒置 | 分析 F2 |
| `toComponents` 的输出通过 `fourierFunctionSchema`(装进函数后) | FR-008 |

## 2. `core/shape/builtins`
```ts
BUILT_IN_SHAPES: readonly BuiltInShape[]     // 8 个, 含 snowflake
```
| 契约 | 需求 |
|---|---|
| 每个 `path()` 长度 ≥ 3、无重合相邻点、首末不重复 | FR-009 |
| 雪花点数 = 6·4³ + 1 段的顶点数, 具有 60° 旋转对称(旋转后与自身的 Hausdorff 距离 < 1e-9) | R4 |
| 字母 F 不具备任何旋转/镜像对称 | FR-009 |

## 3. `core/shape/drawing`
```ts
closeStroke(points: Vec2[]): Result<ShapePath>                      // DRAW_MIN_POINTS / 最短长度校验 → OUT_OF_RANGE 带中文提示
smooth(path: ShapePath, smoothing: number): ShapePath              // 0 → 原样; 循环移动平均
```
| 契约 | 需求 |
|---|---|
| < 20 点或长度 < 5% 短边 → 错误, 提示含"再画长一些" | FR-013 |
| `smooth(p, 0) === p`(引用相等); 点数不变; 自相交数量不变 | FR-014a |
| 以两种不同的速度(点密度)画同一形状, 重采样+平滑后逐点相差 < 2% 尺寸 | FR-014a |

## 4. `core/shape/svg`
```ts
parseSvg(text: string, maxPoints?: number): ImportResult
parsePathData(d: string): Result<readonly Vec2[]>                  // 展平后的折线
```
| 契约 | 需求 |
|---|---|
| M/L/H/V/C/S/Q/T/A/Z, 相对坐标, 多段子路径 | FR-016 |
| `<polygon>`、`<rect>`、`<circle>`、`<ellipse>` 等价转换; `transform` 链应用 | FR-015 |
| 多路径取最长, `pathCount` 与 `warnings` 报告 | FR-015 |
| 10 万点的生成样本在 3 秒内完成解析与转换, 进度回调被调用 ≥ 10 次 | FR-018, 分析 E1 |
| 非 SVG / > 2 MB / > 100 000 点 → `IMPORT_UNSUPPORTED`; 畸形 `d`(`M 1`、`X 0 0`、`1e999`)→ `DATA_CORRUPT`; 无路径 → `NOT_FOUND`; **永不抛异常** | FR-017 |
| 含 `<script>`、`onload`、外部 `<image href>` 的文件: 解析完成且没有任何脚本执行或网络请求(测试中监听) | 安全 |

## 5. `state/documentStore` (扩展)
```ts
applyGenerated(components: readonly HarmonicComponent[]): void      // 一步撤销; presentationMode = 'drawing2d'
```
| 契约 | 需求 |
|---|---|
| 一次 `undo` 恢复到应用前的函数(含关键帧) | FR-006 |
| 分量数 200 时 `addComponent` 返回 `COMPONENT_LIMIT`; 201 个分量的草稿 → `DATA_CORRUPT` | FR-002a |

## 6. `features/shapes` (界面)
| 契约 | 需求 |
|---|---|
| 应用后: `presentationMode = drawing2d`, `time = 0`, 播放中(减少动态效果时暂停于周期末), `showTrail/trailFade/trailRetention = true/false/'all'`, 其余显示选项不变 | FR-007, FR-007a |
| 有未保存修改时先确认; 取消则一切不变 | FR-006 |
| 绘制模式中: 播放暂停、向量拖拽与缩放禁用、笔迹实时显示; 退出恢复播放状态 | FR-012, FR-014 |
| 导入 > 0.5 s 显示进度; 错误以对话框内文字说明, 函数不变 | FR-017, FR-018 |
