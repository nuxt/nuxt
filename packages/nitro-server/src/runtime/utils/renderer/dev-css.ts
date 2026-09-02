import type { H3Event } from 'nitro/h3'
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { normalizeViteManifest } from 'vue-bundle-renderer'

import '../../context'

/**
 * Patch the dev SSR manifest with the CSS modules a dev integration recorded
 * for this request (`event.context.nuxt['~devClientCss']`), so
 * `getRequestDependencies` emits the right `<link>`s / inline styles.
 *
 * in dev the SSR manifest has no per-request CSS, so we attach the modules
 * to the `@vite/client` entry, which `getRequestDependencies` always resolves.
 */
export function patchDevClientCss (event: H3Event, rendererContext: RendererContext): void {
  const css = event.context.nuxt?.['~devClientCss']
  if (!css?.length) { return }

  const current = rendererContext.manifest
  const entry = current?.['@vite/client']
  if (!entry) { return }

  rendererContext.updateManifest(normalizeViteManifest({ ...current, '@vite/client': { ...entry, css } }))
}

const QUERY_RE = /\?.*$/
const LEADING_RELATIVE_RE = /^(?:\.\.?\/)+/

/**
 * Whether a dev stylesheet belongs to one of the modules a render actually used.
 *
 * The dev CSS set is the builder's whole module graph, not a per-request subset, so
 * consumers that must not leak unrelated styles (islands) narrow it with the modules
 * Vue registered during their own render.
 */
export function isStyleOfModule (file: string, modules: Set<string> | string[]): boolean {
  const path = file.replace(QUERY_RE, '')
  for (const mod of modules) {
    const normalized = mod.replace(LEADING_RELATIVE_RE, '')
    if (normalized && (path === normalized || path.endsWith('/' + normalized))) {
      return true
    }
  }
  return false
}
