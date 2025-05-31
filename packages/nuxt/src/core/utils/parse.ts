import type { Node } from 'estree-walker'
import { type SameShape, type TransformOptions, type TransformResult, transform as esbuildTransform } from 'esbuild'
import { tryUseNuxt } from '@nuxt/kit'

export type { Node }

export async function transform<T extends TransformOptions> (input: string | Uint8Array, options?: SameShape<TransformOptions, T>): Promise<TransformResult<T>> {
  return await esbuildTransform(input, { ...tryUseNuxt()?.options.esbuild.options, ...options })
}
