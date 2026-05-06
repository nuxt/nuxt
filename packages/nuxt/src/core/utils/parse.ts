import { tryUseNuxt } from '@nuxt/kit'
import { minifySync, transformSync } from 'rolldown/utils'
import type { MinifyResult, TransformOptions, TransformResult } from 'rolldown/utils'

export function transformAndMinify (input: string, options?: TransformOptions): TransformResult | MinifyResult {
  const oxcOptions = tryUseNuxt()?.options.oxc
  const transformResult = transformSync('', input, { tsconfig: false, ...oxcOptions?.transform.options, ...options })
  const minifyResult = minifySync('', transformResult.code, { compress: { target: oxcOptions?.transform.options.target as 'esnext' || 'esnext' } })

  return {
    ...transformResult,
    ...minifyResult,
  }
}
