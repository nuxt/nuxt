import { fileURLToPath } from 'node:url'
import { isNuxtPrepare, islandsV2, projectSuffix, withMatrix } from '../../matrix.ts'
import { prepareIslandsV2App } from './islands-v2-app.ts'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default withMatrix({
  css: ['~/global.css'],
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  // islands v2 only knows `v-load-client`, so it builds from a rewritten copy of `app/`
  ...(islandsV2 && !isNuxtPrepare ? { srcDir: prepareIslandsV2App(rootDir, `app-islands-v2-${projectSuffix}`) } : {}),
  routeRules: {
    '/redirected-server-page': { redirect: '/server-page' },
  },
  experimental: {
    componentIslands: islandsV2 ? 'v2' : { selectiveClient: 'deep' },
    runtimeBaseURL: true,
  },
  nitro: {
    prerender: {
      routes: [
        '/prerender/island-a',
        '/prerender/island-b',
      ],
    },
  },
})
