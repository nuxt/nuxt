import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'pathe'
import { defineNuxtModule } from '@nuxt/kit'
import { SERVER_RUNTIME_VERSION, getServerRuntime, useServerBuild } from '@nuxt/kit/internal'

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

    // the renderer config re-exports the head module's templates through `#build`
    const headTemplates = new Set(['unhead-options.mjs', 'unhead.config.mjs'])
    nuxt.hook('app:templates', (app) => {
      for (const template of app.templates) {
        if (headTemplates.has(template.filename)) {
          template.write = true
        }
      }
    })

    nuxt.hook('build:done', async () => {
      const dir = join(nuxt.options.buildDir, 'renderer')

      for (const [specifier, module] of Object.entries(serverRuntime.modules)) {
        const file = join(dir, specifier.replace('nuxt/internal/', '') + '.mjs')
        await mkdir(dirname(file), { recursive: true })
        // `serverEntry`'s body is the app entry for a builder that bundles the ssr
        // environment itself; nothing bundles here, so the built entry is imported instead
        const code = module.output === 'serverEntry'
          ? `export { default } from ${JSON.stringify(pathToFileURL(useServerBuild(nuxt).input.serverEntry()).href)}`
          : await module.code()
        await writeFile(file, code, 'utf-8')
      }
    })
  },
})
