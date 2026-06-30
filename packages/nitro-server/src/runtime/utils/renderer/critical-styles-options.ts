import type { Options as BeastiesOptions } from 'beasties'

export function resolveBeastiesOptions (options: boolean | BeastiesOptions): BeastiesOptions {
  return {
    logLevel: 'silent',
    // Leave styles already inlined by `features.inlineStyles` untouched so the two compose safely.
    reduceInlineStyles: false,
    ...(typeof options === 'object' && options ? options : {}),
  }
}
