import { resolve } from 'path'
import { writeFile } from 'fs-extra'
import consola from 'consola'
import { extendTarget, prettyPath } from '../utils'
import { SLSOptions, SLSTarget } from '../config'
import { worker } from './worker'

export const cloudflare: SLSTarget = extendTarget(worker, {
  entry: '{{ runtimeDir }}/cloudflare',
  generateIgnore: [
    'wrangler.toml'
  ],
  hooks: {
    async done ({ targetDir }: SLSOptions) {
      const pkgPath = resolve(targetDir, 'package.json')
      const pkg = {
        private: true,
        main: './_nuxt.js'
      }
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2))
      consola.info('Generated', prettyPath(pkgPath))
      consola.success('Ready to run `wrangler publish`')
    }
  }
})
