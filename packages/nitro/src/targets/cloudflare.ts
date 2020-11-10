import { resolve } from 'path'
import consola from 'consola'
import { extendTarget, writeFile } from '../utils'
import { SLSOptions, SLSTarget } from '../config'
import { worker } from './worker'

export const cloudflare: SLSTarget = extendTarget(worker, {
  entry: '{{ runtimeDir }}/cloudflare',
  generateIgnore: [
    'wrangler.toml'
  ],
  hooks: {
    async done ({ targetDir }: SLSOptions) {
      await writeFile(resolve(targetDir, 'package.json'), JSON.stringify({ private: true, main: './_nuxt.js' }, null, 2))
      await writeFile(resolve(targetDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1 }, null, 2))

      consola.success('Ready to run `wrangler publish`')
    }
  }
})
