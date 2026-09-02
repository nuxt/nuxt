import type { NuxtTemplate, NuxtTypeTemplate, TSReference } from 'nuxt/schema'
import { isAbsolute, join, relative } from 'pathe'

/**
 * Hands the response types nitro scanned into its own `InternalApi` to Nuxt's typed `$fetch`.
 *
 * Emitted rather than declared in this package's own augments, because with
 * `experimental.routeTypedFetch` requests are typed from the generated route set instead, and a
 * route described both ways on one interface is an error.
 */
export const nitroInternalApiTemplate: NuxtTypeTemplate = {
  filename: 'types/nitro-internal-api.d.ts',
  dependsOn: [],
  getContents ({ nuxt }) {
    if (nuxt.options.experimental.routeTypedFetch) {
      return 'export {}\n'
    }
    return /* typescript */`
import type { InternalApi } from 'nitropack/types'

declare module '@nuxt/schema' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ServerRoutes extends InternalApi {}
}
declare module 'nuxt/schema' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ServerRoutes extends InternalApi {}
}
`
  },
}

export const nitroSchemaTemplate: NuxtTemplate = {
  filename: 'types/nitro-nuxt.d.ts',
  dependsOn: [],
  async getContents ({ nuxt }) {
    const references = [] as TSReference[]
    const declarations = [] as string[]
    await nuxt.callHook('nitro:prepare:types', { references, declarations })

    const typesDir = join(nuxt.options.buildDir, 'types')
    const lines = [
      ...references.map(ref => renderReference(ref, typesDir)),
      ...declarations,
    ]

    return /* typescript */`
${lines.join('\n')}

import type { RuntimeConfig } from 'nuxt/schema'
import type { H3Event } from 'h3'
import type { LogObject } from 'consola'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext } from '#app/types'

declare module 'nitropack' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
    appLayout?: string | false
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event, streaming?: boolean }) => void | Promise<void>
    'render:html:chunk': (chunkContext: NuxtRenderChunkContext, context: { event: H3Event }) => void | Promise<void>
    'render:html:close': (closeContext: NuxtRenderCloseContext, context: { event: H3Event }) => void | Promise<void>
    'render:route': (renderRouteContext: NuxtRenderRouteContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
declare module 'nitropack/types' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
    appLayout?: string | false
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event, streaming?: boolean }) => void | Promise<void>
    'render:html:chunk': (chunkContext: NuxtRenderChunkContext, context: { event: H3Event }) => void | Promise<void>
    'render:html:close': (closeContext: NuxtRenderCloseContext, context: { event: H3Event }) => void | Promise<void>
    'render:route': (renderRouteContext: NuxtRenderRouteContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
`
  },
}

function renderReference (ref: TSReference, baseDir: string) {
  const stuff = 'path' in ref
    ? `path="${isAbsolute(ref.path) ? relative(baseDir, ref.path) : ref.path}"`
    : `types="${ref.types}"`
  return `/// <reference ${stuff} />`
}
