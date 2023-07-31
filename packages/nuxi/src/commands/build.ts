import { relative, resolve } from 'pathe'
import { consola } from 'consola'

// we are deliberately inlining this code as a backup in case user has `@nuxt/schema<3.7`
import { writeTypes as writeTypesLegacy } from '../../../kit/src/template'
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
  async invoke (args, options = {}) {
    overrideEnv('production')

    const rootDir = resolve(args._[0] || '.')
    showVersions(rootDir)

    const { loadNuxt, buildNuxt, useNitro, writeTypes = writeTypesLegacy } = await loadKit(rootDir)

    const nuxt = await loadNuxt({
      rootDir,
      dotenv: {
        cwd: rootDir,
        fileName: args.dotenv
      },
      overrides: {
        logLevel: args['log-level'],
        // TODO: remove in 3.8
        _generate: args.prerender,
        ...(args.prerender ? { nitro: { static: true } } : {}),
        ...(options?.overrides || {})
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
