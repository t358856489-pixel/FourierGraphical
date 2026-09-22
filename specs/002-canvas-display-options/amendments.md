# 修订记录: 画布显示选项

**日期**: 2026-09-21 | 来源: `/speckit.analyze` 的发现. 本文件中的条目**优先于** spec / research / data-model / contracts / tasks 中与之冲突的表述.

| ID | 修订 | 取代 |
|---|---|---|
| F1 | `periodOf` 只在每个启用分量的频率都(在 1e-9 以内)等于其 0.001 取整值时才计算周期, 否则返回 `null`. 原因: 数值框提交的是完整精度(如 `1.23456`), 按取整值求 gcd 会得到错误的周期, 使轨迹出现缺口 | research R4, data-model "periodOf" |
| F2 | **形状永远正确**: 保留模式下采样不得低于每圈 `MIN_SAMPLES_PER_TURN = 8` 点. 点数预算不够时, 不再放大步长到失真, 而是**缩短实际保留窗口**到预算能覆盖的长度, `TrailPlan` 增加 `effectiveSeconds` 与 `isShortened`; 界面说明"当前函数频率较高, 轨迹实际保留约 N 秒". 步长仍按 2 的幂放大, 但上限为"每圈 8 点". 删除"轨迹已简化显示"的提示与 `SIMPLIFIED_BELOW_SAMPLES_PER_TURN`. (用户未就此表态; 按分析报告的建议执行, 如需改为"放宽 FR-008"只涉及 `planTrail` 的一条规则) | spec FR-007/FR-008 的"10 分钟"在高频函数下是上限而非保证; research R3 |
| C1 | 自定义背景时: `.stage::after` 的暗角与扫描线覆盖层关闭; 空状态提示文字的颜色取派生配色的 `text`. 两者通过写在 `.stage` 容器上的 CSS 自定义属性实现 | tasks T037 |
| B1 | SC-005 的"逐像素一致"改为"内容与配色一致": 图片按 2× 密度导出、视频补边到 16:9, 分辨率与取景本就不同. 验证方式: 导出与舞台传给 `drawFrame` 的 `view`、`theme` 相同 | spec SC-005 |
| C2 | `--screen-trace-normal` 必须写成字面的 `oklch(...)`: 主题用 `getPropertyValue` 读取自定义属性, `color-mix(...)` 不会被求值, `parseColor` 无法解析 | tasks T022 |
| F3 | OKLCH→sRGB 转换与浏览器的一致性由端到端测试验证(在页面里让浏览器把令牌颜色画到 1×1 的**独立**画布上取值, 与 `parseColor` 比较, 每通道 ≤ 2); T031 中与 `FALLBACK_THEME` 的比对只是粗校验 | contracts §1, tasks T031 |
| D1 | `mix`/`toHex` 及其测试归入基础阶段(与 `parseUserColor` 同批); `traceNormal` 先有失败测试再实现 | tasks T022/T023 |
| F4 | 三个故事可任意顺序实施; 共享文件上"后完成的一方在先完成的一方之上修改", 不要求按任务编号 | tasks "依赖关系" |
| C3 | T002 的默认画面基准用 Playwright `toHaveScreenshot` 的基线文件(仅 chromium project), 属于本机回归护栏; 与环境无关的保障是 T001 的调用序列快照 | tasks T002 |
