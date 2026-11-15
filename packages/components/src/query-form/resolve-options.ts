import type { SelectOption } from "@fbkworks/adapter-core"
import type { SelectOptionsResolver } from "./types"

/**
 * 把 `options` 的数组 / 函数两种形态归一成数组。
 *
 * 公开类型允许 `options: (values) => SelectOption[]`（联动：选了省份后城市选项变化），
 * 但 QueryForm 曾经只把它 `as SelectOption[]` 断言后直接交给适配器 ——
 * 适配器对函数调 `.map`，于是渲染期抛 TypeError，整块查询区挂掉。
 * 断言能过是因为它只骗编译器，运行时没有任何东西把函数变成数组。
 *
 * 解析函数抛错时退化成空选项：用户看到「无选项」比整片白屏好排查。
 */
export function resolveFieldOptions(
  field: { options?: SelectOption[] | SelectOptionsResolver },
  values: Record<string, unknown>,
): SelectOption[] {
  const raw = field.options
  if (!raw) return []
  if (typeof raw === "function") {
    try {
      return raw(values)
    } catch {
      return []
    }
  }
  return raw
}
