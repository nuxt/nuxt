import type { H3Event } from 'nitro/h3'
import { getDevClientCss } from '#internal/nuxt/dev-client-css'

/**
 * Dev-only: record the CSS modules the builder has loaded for this request
 * into the request context, so the SSR renderer can emit the right stylesheet
 * links + inline styles for the route.
 *
 * The CSS set is builder-specific (it comes from the builder's dev module
 * graph), so it is provided through the `#internal/nuxt/dev-client-css`
 * virtual module: the default returns nothing, and a builder overrides it in
 * dev.
 */
export async function recordDevClientCss (event: H3Event): Promise<void> {
  const css = await getDevClientCss()
  if (css?.length) {
    event.context.nuxt ||= {}
    event.context.nuxt['~devClientCss'] = css
  }
}
