import { useNitro } from '@nuxt/kit'
import { filename as _filename } from 'pathe/utils'
import type { Nuxt } from '@nuxt/schema'
import type { NastiPlugin } from '@nasti-toolchain/nasti'

const QUERY_RE = /\?.+$/
function filename (name: string) {
  return _filename(name.replace(QUERY_RE, ''))
}

/**
 * Emits per-component `*-styles.mjs` chunks (inlining their CSS as strings) and a top-level
 * `styles.mjs` manifest mapping component ids to style loaders, registered with Nitro so the
 * SSR renderer can inline critical CSS. Production + `features.inlineStyles` only.
 *
 * Scope note: `@nuxt/vite-builder`'s SSR-styles relies on Vite/Rollup capabilities Nasti
 * does not expose (a plugin-returning `applyToEnvironment`, `?inline&used` resolution,
 * `this.resolve({ skipSelf })`, client→server CSS teleport, manifest CSS stripping). Here we
 * implement what Nasti's plugin context allows: collect the CSS assets present in the SSR
 * bundle and emit them as importable style chunks. Exact per-component attribution and
 * dropping the now-inlined `<link>`s from the client manifest are the remaining M3 work,
 * gated on Nasti plugin-context parity.
 */
export function SSRStylesPlugin (nuxt: Nuxt): NastiPlugin | undefined {
  if (nuxt.options.dev || !nuxt.options.features.inlineStyles) {
    return
  }

  const nitro = useNitro()
  let stylesManifestCode = 'export default {}'

  // Register the manifest virtual eagerly with a lazy getter (content is filled in
  // `generateBundle`, before Nitro reads it).
  nitro.options.virtual ||= {}
  nitro.options._config.virtual ||= {}
  nitro.options.virtual['#build/dist/server/styles.mjs'] = () => stylesManifestCode
  nitro.options._config.virtual['#build/dist/server/styles.mjs'] = () => stylesManifestCode

  return {
    name: 'nuxt:nasti:ssr-styles',
    // SSR environment only — emit styles alongside the server build.
    applyToEnvironment: environment => environment.name === 'ssr',
    generateBundle (_options, bundle) {
      const record = (bundle ?? {}) as Record<string, { type?: string, source?: string | Uint8Array, name?: string }>

      // component key -> emitted `*-styles.mjs` final file name
      const emitted: Record<string, string> = {}

      for (const [fileName, chunk] of Object.entries(record)) {
        if (chunk?.type !== 'asset' || !fileName.endsWith('.css')) {
          continue
        }
        const cssText = typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source ?? '').toString('utf-8')
        if (!cssText) {
          continue
        }
        const key = filename(chunk.name || fileName)
        if (!key) {
          continue
        }
        // Inline the CSS text directly so the emitted module yields it without a separate
        // `?inline` resolution step (which Nasti does not support).
        const ref = this.emitFile({
          type: 'asset',
          name: `${key}-styles.mjs`,
          source: `export default [${JSON.stringify(cssText)}]\n`,
        })
        emitted[key] = this.getFileName(ref)
      }

      const entries = Object.entries(emitted)
        .map(([key, file]) => `  ${JSON.stringify(key)}: () => import('./${file}').then(interopDefault),`)
        .join('\n')

      stylesManifestCode = [
        'const interopDefault = r => r.default || r || []',
        `export default {\n${entries}\n}`,
      ].join('\n')
    },
  }
}
