// 构建产物的包体预算检查 (章程原则 V): 首屏 JS < 300KB gzip, CSS < 50KB, mediabunny 必须按需加载
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const JS_BUDGET = 300 * 1024
const CSS_BUDGET = 50 * 1024

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const assets = readdirSync(join(DIST, 'assets'))
const gzipSize = (file) => gzipSync(readFileSync(join(DIST, 'assets', file))).length
const isInitial = (file) => html.includes(file)

const initialJs = assets.filter((file) => file.endsWith('.js') && isInitial(file))
const initialCss = assets.filter((file) => file.endsWith('.css') && isInitial(file))
const jsBytes = initialJs.reduce((sum, file) => sum + gzipSize(file), 0)
const cssBytes = initialCss.reduce((sum, file) => sum + gzipSize(file), 0)

const failures = []
if (jsBytes >= JS_BUDGET) failures.push(`首屏 JS ${jsBytes} 字节, 超出 ${JS_BUDGET}`)
if (cssBytes >= CSS_BUDGET) failures.push(`首屏 CSS ${cssBytes} 字节, 超出 ${CSS_BUDGET}`)

// 'moov' 是 MP4 容器的 box 名, 只会出现在封装库内部; 应用代码只引用库的导出名
const mentionsMediabunny = (file) =>
  readFileSync(join(DIST, 'assets', file), 'utf8').includes('moov')
if (initialJs.some(mentionsMediabunny)) failures.push('mediabunny 被打进了首屏包, 应为异步 chunk')
if (!assets.some((file) => file.endsWith('.js') && !isInitial(file) && mentionsMediabunny(file))) {
  failures.push('未找到 mediabunny 的异步 chunk')
}

process.stdout.write(
  `首屏 JS ${(jsBytes / 1024).toFixed(1)} KB gzip, CSS ${(cssBytes / 1024).toFixed(1)} KB gzip\n`,
)
if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exit(1)
}
