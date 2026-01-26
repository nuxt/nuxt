import type { NuxtTemplate, TSReference } from 'nuxt/schema'
import { isAbsolute, join, relative } from 'pathe'

export const nitroSchemaTemplate: NuxtTemplate = {
  filename: 'types/nitro-nuxt.d.ts',
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
/// <reference path="./schema.d.ts" />

import type { RuntimeConfig } from 'nuxt/schema'
import type { H3Event } from 'h3'
import type { LogObject } from 'consola'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from 'nuxt/app'

declare module 'nitropack' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use \`noScripts\` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
    appLayout?: string | false
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
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
