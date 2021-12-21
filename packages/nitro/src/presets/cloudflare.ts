import { resolve } from 'pathe'
import { extendPreset, writeFile } from '../utils'
import { NitroContext, NitroPreset } from '../context'
import { worker } from './worker'

export const cloudflare: NitroPreset = extendPreset(worker, {
  entry: '{{ _internal.runtimeDir }}/entries/cloudflare',
  ignore: [
    'wrangler.toml'
  ],
  commands: {
    preview: 'npx miniflare {{ output.serverDir }}/index.mjs --site {{ output.publicDir }}',
    deploy: 'cd {{ output.serverDir }} && npx wrangler publish'
  },
  hooks: {
    async 'nitro:compiled' ({ output, _nuxt }: NitroContext) {
      await writeFile(resolve(output.dir, 'package.json'), JSON.stringify({ private: true, main: './server/index.mjs' }, null, 2))
      await writeFile(resolve(output.dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1 }, null, 2))
    }
  }
})
