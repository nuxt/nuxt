import { resolve } from 'path'
import { extendTarget, writeFile } from '../utils'
import { SLSTarget } from '../config'
import { node } from './node'

export const vercel: SLSTarget = extendTarget(node, {
  targetDir: '{{ rootDir }}/.vercel_build_output',
  outName: 'functions/node/_nuxt/index.js',
  publicDir: '{{ targetDir }}/static',
  inlineChunks: false,
  generateIgnore: [
    'vercel.json'
  ],
  hooks: {
    async done ({ targetDir }) {
      await writeRoutes({ targetDir })
    }
  }
})

async function writeRoutes ({ targetDir }) {
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

  await writeFile(resolve(targetDir, 'config/routes.json'), JSON.stringify(routes, null, 2))
}
