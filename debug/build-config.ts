import process from 'node:process'

import type { InputPluginOption } from 'rollup'

import { AnnotateFunctionTimingsPlugin } from './plugins/timings-unbuild.ts'

export function addRollupTimingsPlugin (options: { plugins: InputPluginOption[] }) {
  if (process.env.TIMINGS_DEBUG) {
    options.plugins.push(AnnotateFunctionTimingsPlugin())
  }
}
