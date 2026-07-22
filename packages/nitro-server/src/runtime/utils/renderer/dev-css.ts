import type { H3Event } from 'nitro/h3'
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { normalizeViteManifest } from 'vue-bundle-renderer'

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
