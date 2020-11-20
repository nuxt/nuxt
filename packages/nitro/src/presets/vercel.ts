import { resolve } from 'upath'
import { extendPreset, writeFile } from '../utils'
import { SigmaPreset, SigmaContext } from '../context'
import { node } from './node'

export const vercel: SigmaPreset = extendPreset(node, {
  output: {
    dir: '{{ _nuxt.rootDir }}/.vercel_build_output',
    serverDir: '{{ output.dir }}/functions/node/_nuxt/index.js',
    publicDir: '{{ output.dir }}/static'
  },
  ignore: [
    'vercel.json'
  ],
  hooks: {
    async 'sigma:compiled' (ctx: SigmaContext) {
      await writeRoutes(ctx)
    }
  }
})

async function writeRoutes ({ output }: SigmaContext) {
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
      dest: '/.vercel/functions/_nuxt/index'
    }
  ]

  await writeFile(resolve(output.dir, 'config/routes.json'), JSON.stringify(routes, null, 2))
}
