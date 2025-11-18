import { tryUseNuxt } from '@nuxt/kit'
import type { TransformOptions, TransformResult } from 'oxc-transform'
import { transform } from 'oxc-transform'
import { minify } from 'oxc-minify'
import type { MinifyResult } from 'oxc-minify'

export async function transformAndMinify (input: string, options?: TransformOptions): Promise<TransformResult | MinifyResult> {
  const oxcOptions = tryUseNuxt()?.options.oxc
  const transformResult = await transform('', input, { ...oxcOptions?.transform.options, ...options })
  const minifyResult = await minify('', transformResult.code, { compress: { target: oxcOptions?.transform.options.target as 'esnext' || 'esnext' } })

  return {
    ...transformResult,
    ...minifyResult,
  }
}
