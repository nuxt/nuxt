import type { NuxtTemplate, NuxtTypeTemplate, TSReference } from 'nuxt/schema'
import { isAbsolute, join, relative } from 'pathe'

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

import type { RouteRuleConfigExtensions, RuntimeConfig } from 'nuxt/schema'
import type { H3Event } from 'nitro/h3'
import type { DevServerLog, NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderDocumentContext, NuxtRenderHTMLContext, NuxtRenderRouteContext } from '#app/types'

declare module 'nitro/types' {
  interface NitroImportMeta {
    test?: boolean
  }
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: DevServerLog[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event, streaming?: boolean }) => void | Promise<void>
    'render:html:chunk': (chunkContext: NuxtRenderChunkContext, context: { event: H3Event }) => void | Promise<void>
    'render:html:close': (closeContext: NuxtRenderCloseContext, context: { event: H3Event }) => void | Promise<void>
    'render:document': (documentContext: NuxtRenderDocumentContext, context: { event: H3Event }) => void | Promise<void>
    'render:route': (renderRouteContext: NuxtRenderRouteContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
    /** @deprecated Called only while the \`nitroLegacy\` layer covers Nitro v2 code. Return a \`Response\` from a server middleware instead. */
    'render:before': (context: { event: H3Event, render: (event: H3Event) => Promise<{ body?: unknown, statusCode?: number, statusMessage?: string, headers?: Record<string, string | string[] | number | undefined> }>, response?: { body?: unknown, statusCode?: number, statusMessage?: string, headers?: Record<string, string | string[] | number | undefined> } }) => void | Promise<void>
    /** @deprecated Called only while the \`nitroLegacy\` layer covers Nitro v2 code. Use the Nitro \`response\` hook instead. */
    'render:response': (response: { body?: string, statusCode?: number, statusMessage?: string, headers?: Record<string, string> }, context: { event: H3Event }) => void | Promise<void>
  }
}

declare module 'h3/rules' {
  interface RouteRuleConfig extends RouteRuleConfigExtensions {}
  interface RouteRuleConfig {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
  }
  interface RouteRules {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
    appLayout?: string | false
  }
}
`
  },
}

/** Declares the Nuxt 4 host to the types this package contributes. */
export const nuxt4HostTypeTemplate: NuxtTypeTemplate = {
  filename: 'types/nitro-server-host.d.ts',
  getContents: () => `declare module '@nuxt/schema' {
  interface NitroServerHost {
    nuxt4: true
  }
}

export {}
`,
}

function renderReference (ref: TSReference, baseDir: string) {
  const stuff = 'path' in ref
    ? `path="${isAbsolute(ref.path) ? relative(baseDir, ref.path) : ref.path}"`
    : `types="${ref.types}"`
  return `/// <reference ${stuff} />`
}
