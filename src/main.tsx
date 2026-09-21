import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { restoreDraft, startAutosave } from './state/autosave'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('缺少 #root 挂载点')

// 先恢复上次的编辑内容 (FR-022) 再渲染, 避免示例函数闪现; 恢复失败不阻止启动
await restoreDraft()
startAutosave()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
