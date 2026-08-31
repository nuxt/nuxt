import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'pathe'
import { defineNuxtModule } from '@nuxt/kit'
import { addRendererConfig, useServerBuild } from '@nuxt/kit/internal'

/**
 * Stands in for the wiring a non-nitro server builder does:
 *
 * - generates `nuxt/renderer-config` from `nuxt.options`
 * - writes the `nuxt/*` build outputs, and the SSR entry, as modules the test resolves
 *   those specifiers to
 */
export default defineNuxtModule({
  meta: { name: 'renderer-artifacts' },
  setup (_options, nuxt) {
    addRendererConfig()

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
      await mkdir(dir, { recursive: true })

      const serverEntry = useServerBuild(nuxt).input.serverEntry()
      const outputs = {
        'entry.mjs': `export { default } from ${JSON.stringify(pathToFileURL(serverEntry).href)}`,
        'manifest.mjs': await nuxt.buildOutputs.clientManifest(),
        'precomputed.mjs': await nuxt.buildOutputs.clientPrecomputed(),
        'styles.mjs': await nuxt.buildOutputs.ssrStyles(),
        'entry-ids.mjs': await nuxt.buildOutputs.entryIds(),
        'entry-chunk.mjs': await nuxt.buildOutputs.entryChunkName(),
      }

      for (const [file, contents] of Object.entries(outputs)) {
        await mkdir(dirname(join(dir, file)), { recursive: true })
        await writeFile(join(dir, file), contents, 'utf-8')
      }
    })
  },
})
