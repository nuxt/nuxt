import { resolve } from 'upath'
import consola from 'consola'
import { extendPreset, writeFile, prettyPath } from '../utils'
import { SigmaContext, SigmaPreset } from '../context'
import { worker } from './worker'

export const cloudflare: SigmaPreset = extendPreset(worker, {
  entry: '{{ _internal.runtimeDir }}/entries/cloudflare',
  ignore: [
    'wrangler.toml'
  ],
  hooks: {
    async 'sigma:compiled' ({ output, _nuxt }: SigmaContext) {
      await writeFile(resolve(output.dir, 'package.json'), JSON.stringify({ private: true, main: './server/index.js' }, null, 2))
      await writeFile(resolve(output.dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1 }, null, 2))
      consola.success('Ready to run `wrangler publish` in', prettyPath(_nuxt.rootDir))
    }
  }
})
