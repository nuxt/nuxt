import { resolve } from 'upath'
import { extendPreset, writeFile } from '../utils'
import { NitroPreset, NitroContext } from '../context'
import { node } from './node'

export const vercel: NitroPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/vercel',
  output: {
    dir: '{{ _nuxt.rootDir }}/.vercel_build_output',
    serverDir: '{{ output.dir }}/functions/node/server',
    publicDir: '{{ output.dir }}/static'
  },
  ignore: [
    'vercel.json'
  ],
  hooks: {
    async 'nitro:compiled' (ctx: NitroContext) {
      await writeRoutes(ctx)
    }
  }
})

async function writeRoutes ({ output }: NitroContext) {
  const routes = [
    {
      src: '/sw.js',
      headers: {
        'cache-control': 'public, max-age=0, must-revalidate'
      },
      continue: true
    },
    {
      src: '/_nuxt/(.*)',
      headers: {
        'cache-control': 'public,max-age=31536000,immutable'
      },
      continue: true
    },
    {
      handle: 'filesystem'
    },
    {
      src: '(.*)',
      dest: '/.vercel/functions/server/index'
    }
  ]

  await writeFile(resolve(output.dir, 'config/routes.json'), JSON.stringify(routes, null, 2))
}
