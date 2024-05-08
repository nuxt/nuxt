import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { readdirSync } from 'node:fs'

import { defineConfig } from 'vite'
import UnoCSS from 'unocss/vite'

import { DevRenderingPlugin } from './lib/dev'
import { RenderPlugin } from './lib/render'

const r = (...path: string[]) => fileURLToPath(new URL(join(...path), import.meta.url))

export default defineConfig({
  build: {
    outDir: process.env.OUTPUT_DIR || 'dist',
    rollupOptions: {
      input: {
        ...Object.fromEntries(
          readdirSync(r('templates')).filter(dir => dir !== 'messages.json').map(dir => [
            dir,
            r('templates', dir, 'index.html'),
          ]),
        ),
        index: r('index.html'),
      },
    },
  },
  plugins: [
    UnoCSS(),
    DevRenderingPlugin(),
    RenderPlugin(),
  ],
  server: {
    fs: {
      allow: ['./templates', __dirname],
    },
  },
})
