import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['./module'],
  ignore: ['**/internal.d.ts'],
  nitro: {
    imports: {
      dirs: [fileURLToPath(new URL('./server/extra', import.meta.url))],
    },
  },
})
