import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'pathe'
import { resolvePath } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { joinURL } from 'ufo'
import type { Plugin } from 'vite'

import { renderIndexHtml } from './html.ts'
import { spaLoadingTemplate } from './output.ts'

/**
 * Path of the SPA document, at the root of the Vite project so that it is emitted at the
 * root of the client output. A project may put a real file here to take over the
 * document entirely, as it would in any other Vite app; otherwise it is generated.
 */
export function documentPath (nuxt: Nuxt): string {
  return resolve(nuxt.options.vite.root || nuxt.options.srcDir, 'index.html')
}

export async function resolveDocument (nuxt: Nuxt): Promise<string> {
  const path = documentPath(nuxt)
  if (existsSync(path)) {
    return readFile(path, 'utf-8')
  }

  const entry = await resolvePath(resolve(nuxt.options.appDir, nuxt.options.dev || nuxt.options.experimental.asyncEntry ? 'entry.async' : 'entry'))
  // in dev the document is served rather than built, so vite resolves the entry from a
  // request URL rather than from the document's own location
  const src = nuxt.options.dev ? joinURL('/@fs', entry) : './' + relative(resolve(path, '..'), entry)

  return renderIndexHtml(nuxt, src, await spaLoadingTemplate(nuxt))
}

/**
 * Provides the generated document as the contents of the HTML build input, so that
 * nothing has to be written into the project to build it.
 */
export function DocumentPlugin (nuxt: Nuxt): Plugin {
  const path = documentPath(nuxt)

  return {
    name: 'nuxt:vite-server:document',
    apply: 'build',
    applyToEnvironment: environment => environment.name === 'client',
    resolveId: {
      order: 'pre',
      filter: { id: new RegExp(`^${escape(path)}$`) },
      handler: id => id,
    },
    load: {
      filter: { id: new RegExp(`^${escape(path)}$`) },
      handler: () => resolveDocument(nuxt),
    },
  }
}

/**
 * `experimental.entryImportMap` rewrites cross-chunk imports of the entry to the bare
 * `#entry` specifier, so that its hash cannot leak into the chunks importing it. That
 * leaves the document responsible for mapping the specifier to the emitted chunk.
 */
export function EntryImportMapPlugin (): Plugin {
  return {
    name: 'nuxt:vite-server:entry-import-map',
    apply: 'build',
    applyToEnvironment: environment => environment.name === 'client',
    transformIndexHtml: {
      order: 'post',
      handler (_html, ctx) {
        for (const chunk of Object.values(ctx.bundle || {})) {
          if (chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'entry') {
            return [{
              tag: 'script',
              attrs: { type: 'importmap' },
              children: JSON.stringify({ imports: { '#entry': './' + chunk.fileName } }),
              injectTo: 'head-prepend',
            }]
          }
        }
      },
    },
  }
}

/**
 * Builds the client environment, and marks the ssr environment as built when nothing
 * will render on the server, so that the orchestrator skips it.
 *
 * A `buildApp` hook rather than a `builder.buildApp` config option, so that a plugin
 * bringing its own deploy target (`@cloudflare/vite-plugin`, for one) keeps its own
 * orchestration and its own environments: those are built as usual.
 */
// TODO: build server environment only when a target claims it
export function BuildEnvironmentsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:vite-server:build-environments',
    apply: 'build',
    buildApp: {
      order: 'post',
      async handler (builder) {
        const ssr = builder.environments.ssr
        if (ssr && nuxt.options.ssr === false) {
          // nothing renders on the server, so the orchestrator can skip the environment
          ssr.isBuilt = true
        }
        for (const environment of [builder.environments.client, ssr]) {
          if (environment && !environment.isBuilt) {
            await builder.build(environment)
          }
        }
      },
    },
  }
}

function escape (path: string) {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
