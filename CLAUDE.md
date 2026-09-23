# FourierGraphical 开发指南

基于所有功能计划自动生成. 最后更新时间: 2026-09-21

## 活跃技术
- TypeScript 6 (strict) + React 19 + Vite 8, 纯前端单页应用, 无后端 (001-fourier-visual-editor)
- Zustand 5(状态)、Zod 4(边界校验)、idb-keyval 6(IndexedDB)、Mediabunny 1.x(视频封装, 动态加载) (001-fourier-visual-editor)
- 渲染: 原生 Canvas 2D; 样式: 原生 CSS + 设计令牌, 不使用 Tailwind 或组件库 (001-fourier-visual-editor)
- 测试: Vitest 5 + React Testing Library + fast-check + fake-indexeddb; Playwright + @axe-core/playwright (001-fourier-visual-editor)

## 项目结构
```
src/
├── core/        # 纯 TypeScript, 无 DOM: 关键帧求值与闭式积分、求值器、播放、撤销、预设、schema
├── render/      # drawFrame: 实时画布 / 图片导出 / 视频导出共用的唯一绘制入口
├── state/       # documentStore(可撤销) / playbackStore / viewStore
├── storage/     # FunctionRepository 接口 + IndexedDB 与内存实现
├── export/      # 图片与视频导出
├── features/    # stage / components-panel / transport / timeline / presets / library / export-dialog
├── ui/  hooks/  styles/
tests/
├── e2e/  visual/  fixtures/
```

## 命令
```bash
pnpm dev | pnpm test | pnpm test:coverage | pnpm test:e2e | pnpm lint | pnpm typecheck | pnpm build
```

## 代码风格
- 所有领域数据不可变; `src/core/` 只写纯函数, 可失败操作返回 `Result<T>` 而不抛异常
- 图形必须是 `(函数, 时刻 t)` 的纯函数: 禁止逐帧累加角度或轨迹 (见 specs/001-fourier-visual-editor/research.md R4、R5)
- 画布由 requestAnimationFrame 直接订阅 store 绘制, 不经过 React 渲染
- 保留的轨迹同样是纯函数: 由 `planTrail(fn, t, view, mode)` 算出区间与步长, 不累积; "正常亮度"用不透明混色而非 globalAlpha (specs/002-canvas-display-options/research.md R1–R4)
- 默认显示设置下的画面必须与功能 001 逐像素一致; 任意背景色下线条对比度 ≥ 3:1、文字 ≥ 4.5:1
- 严格 TDD; 覆盖率整体 ≥ 80%, `src/core` ≥ 95%
- 单文件 < 800 行, 单函数 < 50 行; 按功能而非文件类型组织

## 最近变更
- 002-canvas-display-options: 已实现(网格/坐标轴分离、轨迹保留、背景色). 不新增依赖. 新增纯函数模块 `core/color`、`core/trailPlan`、`render/palette`; 显示选项只进 `ViewSettings`(应用级偏好), 已保存函数的格式不变
- 001-fourier-visual-editor: 新增实施计划(规范、研究、数据模型、契约、quickstart)

<!-- 手动添加内容开始 -->
<!-- 手动添加内容结束 -->
