import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  experimental: {
    // `server/api/me.ts` relies on auto-imported `h3` utilities; Nuxt 5 defaults this off.
    nitroAutoImports: true,
  },
  routeRules: {
    '/protected/cache-cookie': { cache: { maxAge: 60, varies: ['cookie'] } },
    '/protected/isr-appmw': { isr: 60, appMiddleware: 'require-session-app' },
  },
})
