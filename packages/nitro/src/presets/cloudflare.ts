import { resolve } from 'upath'
import consola from 'consola'
import { extendPreset, writeFile, prettyPath } from '../utils'
import { NitroContext, NitroPreset } from '../context'
import { worker } from './worker'

export const cloudflare: NitroPreset = extendPreset(worker, {
  entry: '{{ _internal.runtimeDir }}/entries/cloudflare',
  ignore: [
    'wrangler.toml'
  ],
  hooks: {
    async 'nitro:compiled' ({ output, _nuxt }: NitroContext) {
      await writeFile(resolve(output.dir, 'package.json'), JSON.stringify({ private: true, main: './server/index.mjs' }, null, 2))
      await writeFile(resolve(output.dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1 }, null, 2))
      let inDir = prettyPath(_nuxt.rootDir)
      if (inDir) {
        inDir = 'in ' + inDir
      }
      consola.success('Ready to run `wrangler publish`', inDir)
    }
  }
})
