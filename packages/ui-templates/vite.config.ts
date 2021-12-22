import { resolve } from 'path'
import { readdirSync } from 'fs'

import { defineConfig } from 'vite'
import WindiCSS from 'vite-plugin-windicss'

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
    WindiCSS({
      scan: {
        dirs: ['templates'],
        fileExtensions: ['html']
      }
    }),
    DevRenderingPlugin(),
    RenderPlugin()
  ],
  server: {
    fs: {
      allow: ['./templates', __dirname]
    }
  }
})
