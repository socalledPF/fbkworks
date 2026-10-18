import type { Size } from '@fbk/adapter-core'

export const toElementSize = (size: Size = 'md'): 'small' | 'default' | 'large' => {
  if (size === 'sm') return 'small'
  if (size === 'lg') return 'large'
  return 'default'
}
