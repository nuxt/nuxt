import { fileURLToPath } from 'node:url'
import process from 'node:process'

import type { InputPluginOption } from 'rollup'
import type { BuildOptions } from 'unbuild'

import { AnnotateFunctionTimingsPlugin } from './plugins/timings-unbuild'

export const stubOptions = {
  jiti: {
    transformOptions: {
      babel: {
        plugins: (process.env.TIMINGS_DEBUG ? [fileURLToPath(new URL('./plugins/timings-babel.mjs', import.meta.url))] : []) as any,
      },
    },
  },
  absoluteJitiPath: true,
} satisfies BuildOptions['stubOptions']

export function addRollupTimingsPlugin (options: { plugins: InputPluginOption[] }) {
  if (process.env.TIMINGS_DEBUG) {
    options.plugins.push(AnnotateFunctionTimingsPlugin())
  }
}
