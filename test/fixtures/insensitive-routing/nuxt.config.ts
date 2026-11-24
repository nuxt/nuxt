import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  router: {
    options: {
      sensitive: false,
    },
  },
  routeRules: {
    '/redirect': { redirect: '/' },
    '/old/**': { redirect: '/new/**' },
    '/wildcard-proxy/**': { proxy: '/api/tail/**' },
    '/headers/**': { headers: { 'x-route-rule': 'headers' } },
    '/Mixed-Case': { headers: { 'x-route-rule': 'mixed-case' } },
    '/proxy': { proxy: '/api/proxy-target' },
    '/spa': { ssr: false },
    '/no-scripts': { noScripts: true },
    '/rules': { headers: { 'x-route-rule': 'rules' } },
  },
})
