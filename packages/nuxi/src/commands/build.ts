import { relative, resolve } from 'pathe'
import { consola } from 'consola'
import { writeTypes } from '../utils/prepare'
import { loadKit } from '../utils/kit'
import { clearBuildDir } from '../utils/fs'
import { overrideEnv } from '../utils/env'
import { showVersions } from '../utils/banner'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'build',
    usage: 'npx nuxi build [--prerender] [--dotenv] [--log-level] [rootDir]',
    description: 'Build nuxt for production deployment'
  },
  async invoke (args) {
    overrideEnv('production')

    const rootDir = resolve(args._[0] || '.')
    showVersions(rootDir)

    const { loadNuxt, buildNuxt, useNitro } = await loadKit(rootDir)

    const nuxt = await loadNuxt({
      rootDir,
      dotenv: {
        cwd: rootDir,
        fileName: args.dotenv
      },
      overrides: {
        logLevel: args['log-level'],
        _generate: args.prerender
      }
    })

    // Use ? for backward compatibility for Nuxt <= RC.10
    const nitro = useNitro?.()

    await clearBuildDir(nuxt.options.buildDir)

    await writeTypes(nuxt)

    nuxt.hook('build:error', (err) => {
      consola.error('Nuxt Build Error:', err)
      process.exit(1)
    })

    await buildNuxt(nuxt)

    if (args.prerender) {
      if (!nuxt.options.ssr) {
        consola.warn('HTML content not prerendered because `ssr: false` was set. You can read more in `https://nuxt.com/docs/getting-started/deployment#static-hosting`.')
      }
      // TODO: revisit later if/when nuxt build --prerender will output hybrid
      const dir = nitro?.options.output.publicDir
      const publicDir = dir ? relative(process.cwd(), dir) : '.output/public'
      consola.success(`You can now deploy \`${publicDir}\` to any static hosting!`)
    }
  }
})
