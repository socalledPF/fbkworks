import { defineVueLib } from '../internal/build-config/src/index.ts'

export default defineVueLib({
  root: import.meta.dirname,
  entries: {
    index: 'src/index.ts',
  },
})
