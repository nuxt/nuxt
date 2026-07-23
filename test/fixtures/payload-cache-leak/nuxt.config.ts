import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  routeRules: {
    '/protected/cache-cookie': { cache: { maxAge: 60, varies: ['cookie'] } },
    '/protected/isr-appmw': { isr: 60, appMiddleware: 'require-session-app' },
  },
})
