import { tryUseNuxt } from '@nuxt/kit'
import { type TransformOptions, type TransformResult } from 'oxc-transform'
import { transform as oxcTransform } from 'oxc-transform'
import { minify } from 'oxc-minify'

// TODO: Do we even need this?
type SameShape<Out, In extends Out> = In & { [Key in Exclude<keyof In, keyof Out>]: never }

export function transformAndMinify<T extends TransformOptions> (input: string, options?: SameShape<TransformOptions, T>): TransformResult {
  // not async until https://github.com/oxc-project/oxc/issues/10900
  const transformResult = oxcTransform('', input, { ...tryUseNuxt()?.options.oxc.transform.options, ...options })
  const minifyResult = minify('', transformResult.code, { compress: { target: 'esnext' } })

  return {
    ...transformResult,
    ...minifyResult,
  }
}
