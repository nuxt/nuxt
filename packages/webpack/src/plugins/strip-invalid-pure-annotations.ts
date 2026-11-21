import type { Compiler, WebpackPluginInstance } from 'webpack'
import { isJS } from './vue/util.ts'

const INVALID_ANNOTATION_RE = /\/\*\s*[#@]__PURE__\s*\*\/(?=\s*(?:\(\/\* unused pure expression or super \*\/ null && \(|0(?![\w$.])))/g

/**
 * Replace any orphaned `/* @__PURE__ *\/` that webpack and rspack leave in
 * front of their dead-code stubs, or of the `0` a call in a dead branch is
 * replaced with, with whitespace of equal length. Exported for unit testing.
 */
export function stripInvalidPureAnnotations (code: string): string {
  if (!code.includes('__PURE__')) { return code }
  return code.replace(INVALID_ANNOTATION_RE, annotation => ' '.repeat(annotation.length))
}

/**
 * Strip the `/* @__PURE__ *\/` annotation that webpack and rspack leave in
 * front of their `(/* unused pure expression or super *\/ null && (...))`
 * stubs for unused exports. When Nitro re-bundles the SSR output through
 * Rolldown, that pass rejects the annotation position and emits a noisy
 * `INVALID_ANNOTATION` warning. The stub still evaluates to `null && (...)`,
 * so dropping the orphaned annotation is safe.
 *
 * The replacement is the same length as the original comment so column
 * positions (and therefore the emitted sourcemap) stay aligned.
 */
export class StripInvalidPureAnnotationsPlugin implements WebpackPluginInstance {
  apply (compiler: Compiler) {
    compiler.hooks.compilation.tap('StripInvalidPureAnnotationsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'StripInvalidPureAnnotationsPlugin',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
      }, (assets) => {
        for (const [filename, asset] of Object.entries(assets)) {
          if (!isJS(filename)) { continue }

          const source = asset.source()
          const code = typeof source === 'string' ? source : source.toString()
          const replaced = stripInvalidPureAnnotations(code)
          if (replaced === code) { continue }

          assets[filename] = new compiler.webpack.sources.RawSource(replaced)
        }
      })
    })
  }
}
