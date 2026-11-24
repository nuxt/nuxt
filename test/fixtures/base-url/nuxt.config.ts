import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  app: {
    baseURL: '/foo/',
  },
  routeRules: {
    '/no-ssr': { ssr: false },
    '/prerendered': { prerender: true },
    '/api/prerendered-fetch': { prerender: true },
    '/api/echo': { headers: { 'x-echo': '1' } },
  },
  hooks: {
    async 'nitro:build:public-assets' (nitro) {
      await writeFile(join(nitro.options.output.publicDir, 'hook-asset.txt'), 'written in nitro:build:public-assets')
    },
  },
})
