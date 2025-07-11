import { tryUseNuxt } from '@nuxt/kit'
import type { TransformOptions, TransformResult } from 'oxc-transform'
import { transform as oxcTransform } from 'oxc-transform'
import { minify, type MinifyResult } from 'oxc-minify'

export function transformAndMinify (input: string, options?: TransformOptions): TransformResult | MinifyResult {
  // not async until https://github.com/oxc-project/oxc/issues/10900
  const oxcOptions = tryUseNuxt()?.options.oxc
  const transformResult = oxcTransform('', input, { ...oxcOptions?.transform.options, ...options })
  const minifyResult = minify('', transformResult.code, { compress: { target: oxcOptions?.transform.options.target as 'esnext' || 'esnext' } })

  return {
    ...transformResult,
    ...minifyResult,
  }
}
