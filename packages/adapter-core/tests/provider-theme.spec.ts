import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createMockAdapter } from '@fbkworks/test-utils'
import { FbkProvider } from '../src/plugin'
import type { ThemeMode, UiAdapter } from '../src'

/**
 * 主题的「谁最后 apply 谁负责」。
 *
 * 1. 内层 Provider 卸载后，watchEffect 随 scope 停掉，没有第二个人把外层主题写回去
 *    —— DOM 会停在内层的档位上（data-fbk-theme 与 :root 变量都不回滚）。
 * 2. theme='system' 只在 apply 时读一次 matchMedia 快照，系统切深浅色界面不跟随。
 *
 * 这里用「记录 apply 参数」的适配器，断言的是调用序列，而不是 DOM 残留。
 */

function createRecordingAdapter(): { adapter: UiAdapter; applied: ThemeMode[] } {
  const adapter = createMockAdapter()
  const applied: ThemeMode[] = []
  adapter.theme = {
    apply: (mode) => {
      applied.push(mode)
    },
    providerProps: () => ({}),
  }
  return { adapter, applied }
}

const containers: HTMLElement[] = []

function createContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  containers.push(el)
  return el
}

function mountApp(render: () => any) {
  const app = createApp({ render })
  const container = createContainer()
  app.mount(container)
  return { app, container }
}

/** jsdom 的 matchMedia 不会主动派发 change，这里给出可手动触发的替身 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  let matches = initialMatches
  const query = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener: (type: string, listener: (event: { matches: boolean }) => void) => {
      if (type === 'change') listeners.delete(listener)
    },
    addListener: (listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeListener: (listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  }
  vi.spyOn(window, 'matchMedia').mockImplementation(() => query as any)
  return {
    listeners,
    emit(next: boolean) {
      matches = next
      for (const listener of [...listeners]) listener({ matches: next })
    },
  }
}

afterEach(() => {
  for (const el of containers.splice(0)) el.remove()
  vi.restoreAllMocks()
})

describe('嵌套 Provider 的主题回滚', () => {
  it('内层 Provider 卸载后把父级主题重新 apply 回来', async () => {
    const { adapter, applied } = createRecordingAdapter()
    const showInner = ref(true)
    const { app } = mountApp(() =>
      h(
        FbkProvider,
        { adapter, theme: 'light' },
        {
          default: () =>
            showInner.value
              ? h(FbkProvider, { theme: 'dark' }, { default: () => h('i', { id: 'inner' }) })
              : h('i', { id: 'after' }),
        },
      ),
    )
    await nextTick()
    expect(applied, '挂载序列应先是外层再是内层').toEqual(['light', 'dark'])

    showInner.value = false
    await nextTick()

    // 卸载内层后必须有人把父级主题写回去，否则 DOM 停在 dark 上
    expect(applied).toEqual(['light', 'dark', 'light'])

    app.unmount()
  })

  it('兄弟 Provider 卸载后恢复的仍是在挂载的那个，而不是父级档位', async () => {
    const { adapter, applied } = createRecordingAdapter()
    const showA = ref(true)
    const { app } = mountApp(() =>
      h(
        FbkProvider,
        { adapter, theme: 'light' },
        {
          default: () => [
            showA.value
              ? h(FbkProvider, { theme: 'dark' }, { default: () => h('i', { id: 'a' }) })
              : null,
            h(FbkProvider, { theme: 'cyber' }, { default: () => h('i', { id: 'b' }) }),
          ],
        },
      ),
    )
    await nextTick()
    expect(applied).toEqual(['light', 'dark', 'cyber'])

    showA.value = false
    await nextTick()

    expect(applied).toEqual(['light', 'dark', 'cyber', 'cyber'])

    app.unmount()
  })
})

describe("theme='system' 跟随系统深浅色", () => {
  it('matchMedia 变化触发重新 apply，卸载后监听被移除', async () => {
    const media = installMatchMedia(false)
    const { adapter, applied } = createRecordingAdapter()
    const { app } = mountApp(() =>
      h(FbkProvider, { adapter, theme: 'system' }, { default: () => h('i', { id: 'sys' }) }),
    )
    await nextTick()
    expect(applied).toEqual(['light'])
    expect(media.listeners.size, 'system 档位必须监听 matchMedia 变化').toBe(1)

    media.emit(true)
    await nextTick()
    expect(applied).toEqual(['light', 'dark'])

    app.unmount()
    expect(media.listeners.size, '卸载后监听必须被移除').toBe(0)

    media.emit(false)
    await nextTick()
    expect(applied, '卸载后不应再触发 apply').toEqual(['light', 'dark'])
  })
})
