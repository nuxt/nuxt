import type { RsbuildOptions } from '../types/config.ts'
import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  rsbuild: {
    $resolve: val => (val && typeof val === 'object' ? val : {}) as RsbuildOptions,
  },
})
