/**
 * 架构图点击放大。
 *
 * 为什么需要：架构图原始宽度 716–1588px，而文档正文栏约 688px。
 *   · 直接按原始尺寸渲染 → 图被正文栏截断，纵向也超出视口，看不全也读不了
 *   · 压到栏宽 → 整张能看见，但字只剩 5–6px
 *   · 加横向滚动 → 要来回拖才能拼出全貌，反而看不出架构的整体结构
 *
 * 所以取「缩略 + 点击放大」：默认仍由 mermaid 的 useMaxWidth 缩到栏宽
 * （一眼看到整体），点击后在覆盖层里按 viewBox 的原始尺寸显示，可自由滚动。
 */
const OVERLAY = 'fbk-diagram-zoom'
const LOCK = 'fbk-diagram-zoom-open'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 从 viewBox 取原始像素尺寸 */
function viewBoxSize(svg: SVGSVGElement): { w: number; h: number } | null {
  const parts = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  if (!parts || parts.length < 4) return null
  const width = parts[2]
  const height = parts[3]
  if (!(width! > 0) || !(height! > 0)) return null
  return { w: Math.ceil(width!), h: Math.ceil(height!) }
}

let closeZoom: () => void = () => {}

function openZoom(source: SVGSVGElement): void {
  const size = viewBoxSize(source)
  if (!size) return
  closeZoom()

  const overlay = document.createElement('div')
  overlay.className = OVERLAY
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', '架构图放大视图')

  const stage = document.createElement('div')
  stage.className = `${OVERLAY}__stage`
  stage.tabIndex = -1

  /* 克隆一份按原始尺寸显示；不动页面上那份，避免影响缩略视图。
     **id 要换成唯一的，但不能删**：
       · 保留原 id → 页面上出现两个 id 相同的 svg（违反 HTML 规范），
         按 id 重新渲染的代码会把覆盖层这份冲回 width="100%"（实测约 0.8s 后发生）
       · 直接删掉 id → mermaid 内部 <style> 用的是 `#<id> .node rect{...}` 这类
         作用域选择器，删了之后样式全部失效，边线退回 SVG 默认的黑色填充
     所以改名 + 同步改写 <style> 里的选择器。 */
  const originalId = source.getAttribute('id')
  const zoomId = `${originalId ?? 'mermaid'}-zoom`
  const clone = source.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style')
  clone.setAttribute('id', zoomId)
  if (originalId) {
    /* 用带边界的正则而不是 replaceAll：`#mermaid-1` 是 `#mermaid-1_xxx` 的前缀，
       直接替换会把 marker 等更长的选择器一起改坏。 */
    const scoped = new RegExp(`#${escapeRegExp(originalId)}(?![\\w-])`, 'g')
    for (const style of clone.querySelectorAll('style')) {
      if (style.textContent) {
        style.textContent = style.textContent.replace(scoped, `#${zoomId}`)
      }
    }
  }
  clone.setAttribute('width', String(size.w))
  clone.setAttribute('height', String(size.h))
  clone.style.maxWidth = 'none'
  stage.append(clone)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = `${OVERLAY}__close`
  button.setAttribute('aria-label', '关闭')
  button.textContent = '×'

  overlay.append(stage, button)
  document.body.append(overlay)
  document.documentElement.classList.add(LOCK)

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeZoom()
  }
  const onBackdrop = (event: MouseEvent): void => {
    if (event.target === overlay) closeZoom()
  }

  document.addEventListener('keydown', onKey)
  overlay.addEventListener('click', onBackdrop)
  button.addEventListener('click', () => closeZoom())

  closeZoom = (): void => {
    document.removeEventListener('keydown', onKey)
    overlay.removeEventListener('click', onBackdrop)
    document.documentElement.classList.remove(LOCK)
    overlay.remove()
    closeZoom = () => {}
  }

  stage.focus({ preventScroll: true })
}

export function setupMermaidZoom(): void {
  if (typeof document === 'undefined') return

  /* 事件委托：VitePress 是 SPA，图会在路由切换后重新渲染，
     绑在具体元素上的监听会失效，委托到 document 不受影响。 */
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return
    const container = target.closest('.mermaid')
    if (!container) return
    const svg = container.querySelector('svg')
    if (svg) openZoom(svg as SVGSVGElement)
  })
}
