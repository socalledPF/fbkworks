/**
 * mermaid 宽度归一化。
 *
 * 背景：mermaid 的 `useMaxWidth` 只对 flowchart / sequence 生效 ——
 * mermaid 11 的 classDiagram 不读这个配置（该 chunk 里 `useMaxWidth` 出现 0 次），
 * 它总是给 svg 挂 `width="100%"`。结果宽图被强行压进正文栏：
 * 架构类图的 viewBox 约 1487px，在 688px 的栏里只剩 0.46 倍，
 * 框里的字约 6px —— 看起来就是「内容显示不全」。
 *
 * 所以这里统一兜底：凡是仍是 `width="100%"` 的图，按 viewBox 还原成原始像素宽。
 * 超出正文栏的部分由 `.vp-doc .mermaid` 的横向滚动承接（见 docs.css）。
 * 其它图类型已经被 config.mts 里的 useMaxWidth: false 处理，不会走到这里。
 */
const SELECTOR = '.mermaid svg[width="100%"]'

function apply(): void {
  for (const svg of document.querySelectorAll<SVGSVGElement>(SELECTOR)) {
    const parts = svg.getAttribute('viewBox')?.split(/[\s,]+/)
    const width = Number(parts?.[2])
    if (!Number.isFinite(width) || width <= 0) continue
    svg.setAttribute('width', String(Math.ceil(width)))
    svg.style.maxWidth = 'none'
  }
}

export function normalizeMermaidWidth(): void {
  if (typeof document === 'undefined') return

  let queued = false
  const schedule = (): void => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      apply()
    })
  }

  const start = (): void => {
    apply()
    /* mermaid 渲染是异步的，且 VitePress 是 SPA —— 新图随时可能插入。
       只观察 childList，不回写会触发观察的属性，因此不会自激。 */
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
