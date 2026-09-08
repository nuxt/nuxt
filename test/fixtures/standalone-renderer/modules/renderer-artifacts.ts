import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'pathe'
import { addTemplate, defineNuxtModule } from '@nuxt/kit'
import { SERVER_RUNTIME_VERSION, getServerRuntime } from '@nuxt/kit/internal'

/**
 * Stands in for the wiring a non-nitro server builder does: it asks core what the renderer
 * needs and writes each module out as a file, which the test resolves the specifiers to.
 */
export default defineNuxtModule({
  meta: { name: 'renderer-artifacts' },
  setup (_options, nuxt) {
    const serverRuntime = getServerRuntime({}, nuxt)

    if (serverRuntime.version !== SERVER_RUNTIME_VERSION) {
      throw new Error(`[renderer-artifacts] unsupported server runtime contract v${serverRuntime.version}`)
    }

    // templates the SSR bundle imports through `#build`, or that the renderer config
    // re-exports, have to exist on disk for a build with no server runtime to resolve
    const written = new Set(['unhead-options.mjs', 'unhead.config.mjs', 'paths.mjs'])
    nuxt.hook('app:templates', (app) => {
      for (const template of app.templates) {
        if (written.has(template.filename)) {
          template.write = true
        }
      }
    })

    // the runtime the app build's own bundle expects from its server builder
    addTemplate({
      filename: 'standalone/fetch.mjs',
      write: true,
      getContents: () => 'export const fetch = (...args) => globalThis.fetch(...args)',
    })
    addTemplate({
      filename: 'standalone/runtime-config.mjs',
      write: true,
      getContents: ({ nuxt }) => [
        `const config = ${JSON.stringify({ app: nuxt.options.runtimeConfig.app, public: nuxt.options.runtimeConfig.public })}`,
        'export const useRuntimeConfig = () => config',
      ].join('\n'),
    })

    nuxt.hook('build:done', async () => {
      const dir = join(nuxt.options.buildDir, 'renderer')

      for (const [specifier, module] of Object.entries(serverRuntime.modules)) {
        const file = join(dir, specifier.replace('nuxt/internal/', '') + '.mjs')
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, await module.code(), 'utf-8')
      }
    })
  },
})
