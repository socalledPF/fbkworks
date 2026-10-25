/**
 * 可观测性事件类型。
 *
 * 设计见 docs/design/2026-10-25-observability.md。
 *
 * 核心约束：**默认不采集**。未传钩子时这些类型不会产生任何运行时开销。
 */

/** 错误来源 */
export type FbkErrorSource = 'component' | 'request' | 'render'

export interface FbkErrorEvent {
  /** 错误来源。request = 数据请求失败；component = 组件内部失败；render = 渲染期异常 */
  source: FbkErrorSource
  /** 组件名，如 'FbkProTable' */
  component?: string
  message: string
  stack?: string
  /**
   * 上下文。**已由库截断** —— 大数组/长字符串会被替换成摘要，
   * 避免上报体积失控与数据泄漏。
   */
  context?: Record<string, unknown>
}

export type FbkTelemetryType = 'request' | 'interaction'

export interface FbkTelemetryEvent {
  type: FbkTelemetryType
  /** 事件名，如 'ProTable.request' */
  name: string
  /** 耗时（ms），仅 request 类有意义 */
  duration?: number
  success?: boolean
  context?: Record<string, unknown>
}

export interface FbkReporterOptions {
  onError?: (event: FbkErrorEvent) => void
  onTelemetry?: (event: FbkTelemetryEvent) => void
}

/** 组件内部使用的上报器。未配置时所有方法都是空实现 */
export interface FbkReporter {
  error: (event: FbkErrorEvent) => void
  telemetry: (event: FbkTelemetryEvent) => void
  /** 是否已配置（便于测试与调试） */
  readonly enabled: boolean
  /**
   * 原始回调。供嵌套 Provider 继承 ——
   * 内层未传钩子时应该继续用外层的，而不是静默关掉上报。
   */
  readonly handlers: FbkReporterOptions
}

/** 数组最多保留几项 */
const MAX_ARRAY_ITEMS = 5
/** 字符串最多保留多少字符 */
const MAX_STRING_LENGTH = 200
/** 最多遍历几个 key（防止巨大对象拖慢上报） */
const MAX_KEYS = 20

/**
 * 截断上下文。
 *
 * 为什么必须做：一个含 500 行的表格数据被塞进上报，
 * 既慢又可能把敏感数据带到第三方平台。
 *
 * 策略：原始值原样保留，数组/对象/长字符串换成摘要。
 */
export function safeContext(input: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined
  if (depth > 2) return { _: '[嵌套过深，已省略]' }

  const out: Record<string, unknown> = {}
  const entries = Object.entries(input as Record<string, unknown>).slice(0, MAX_KEYS)

  for (const [key, value] of entries) {
    if (value === null || value === undefined) {
      out[key] = value
    } else if (typeof value === 'string') {
      out[key] =
        value.length > MAX_STRING_LENGTH
          ? `${value.slice(0, MAX_STRING_LENGTH)}…（共 ${value.length} 字符）`
          : value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    } else if (Array.isArray(value)) {
      out[key] =
        value.length > MAX_ARRAY_ITEMS
          ? [...value.slice(0, MAX_ARRAY_ITEMS), `…共 ${value.length} 项`]
          : value
    } else if (value instanceof Date) {
      out[key] = value.toISOString()
    } else if (typeof value === 'object') {
      // 深层对象：只报类型，不展开
      const nested = safeContext(value, depth + 1)
      out[key] = nested ?? '[object]'
    } else {
      out[key] = String(value)
    }
  }

  return out
}

/** 从任意异常里提取可上报的形状 */
export function toErrorEvent(
  err: unknown,
  source: FbkErrorSource,
  component?: string,
  context?: unknown,
): FbkErrorEvent {
  const isError = err instanceof Error
  return {
    source,
    component,
    message: isError ? err.message : String(err),
    stack: isError ? err.stack : undefined,
    context: safeContext(context),
  }
}

/** 空实现。未配置钩子时用它，保证调用方不需要判空 */
export const NOOP_REPORTER: FbkReporter = {
  error: () => {},
  telemetry: () => {},
  enabled: false,
  handlers: {},
}

/** 根据配置创建上报器 */
export function createReporter(options: FbkReporterOptions = {}): FbkReporter {
  const { onError, onTelemetry } = options
  const enabled = Boolean(onError || onTelemetry)

  if (!enabled) return NOOP_REPORTER

  return {
    enabled,
    handlers: { onError, onTelemetry },
    error: (event) => {
      try {
        onError?.(event)
      } catch {
        /* 上报器自身抛错不能影响业务 */
      }
    },
    telemetry: (event) => {
      try {
        onTelemetry?.(event)
      } catch {
        /* 同上 */
      }
    },
  }
}
