import { resolve } from 'path'
import { readdirSync } from 'fs'

import { defineConfig } from 'vite'
import UnoCSS from 'unocss/vite'

import { DevRenderingPlugin } from './lib/dev'
import { RenderPlugin } from './lib/render'

const r = (...path: string[]) => resolve(__dirname, ...path)

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        ...Object.fromEntries(
          readdirSync(r('templates')).filter(dir => dir !== 'messages.json').map(dir => [
            dir,
            r('templates', dir, 'index.html')
          ])
        ),
        index: r('index.html')
      }
    }
  },
  plugins: [
    UnoCSS(),
    DevRenderingPlugin(),
    RenderPlugin()
  ],
  server: {
    fs: {
      allow: ['./templates', __dirname]
    }
  }
})
