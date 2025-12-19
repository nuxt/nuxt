import { tryUseNuxt } from '@nuxt/kit'
import type { TransformOptions, TransformResult } from 'oxc-transform'
import { transformSync } from 'oxc-transform'
import { minifySync } from 'oxc-minify'
import type { MinifyResult } from 'oxc-minify'

export function transformAndMinify (input: string, options?: TransformOptions): TransformResult | MinifyResult {
  const oxcOptions = tryUseNuxt()?.options.oxc
  const transformResult = transformSync('', input, { ...oxcOptions?.transform.options, ...options })
  const minifyResult = minifySync('', transformResult.code, { compress: { target: oxcOptions?.transform.options.target as 'esnext' || 'esnext' } })

  return {
    ...transformResult,
    ...minifyResult,
  }
}
