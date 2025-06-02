import type { SameShape, TransformOptions, TransformResult } from 'esbuild'
import { transform as esbuildTransform } from 'esbuild'
import { tryUseNuxt } from '@nuxt/kit'

export async function transform<T extends TransformOptions> (input: string | Uint8Array, options?: SameShape<TransformOptions, T>): Promise<TransformResult<T>> {
  return await esbuildTransform(input, { ...tryUseNuxt()?.options.esbuild.options, ...options })
}
