import { describe, expect, it, vi } from 'vitest'

import { MAX_REDIRECTS } from '#app/utils/redirect-loop'

describe('universal router', () => {
  it('should provide a route', () => {
    expect(useRoute()).toMatchObject({
      fullPath: '/',
      hash: '',
      matched: expect.arrayContaining([]),
      meta: {},
      params: {},
      path: '/',
      query: {},
      redirectedFrom: undefined,
    })
  })

  it('applies the latest navigation when concurrent navigations race', async () => {
    const router = useRouter()

    let resolveSlowGuard: () => void
    let slowGuardEntered: (() => void) | undefined
    const entered = new Promise<void>((resolve) => { slowGuardEntered = resolve })
    const removeGuard = router.beforeEach(async (to) => {
      if (to.path === '/slow') {
        slowGuardEntered!()
        await new Promise<void>((resolve) => { resolveSlowGuard = resolve })
      }
    })

    const older = router.push('/slow')
    await entered
    const newer = router.push('/fast')
    await newer
    resolveSlowGuard!()
    await older
    removeGuard()

    expect(router.currentRoute.value.path).toBe('/fast')
  })

  it('does not treat concurrent navigation to the same route as a redirect loop', async () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const router = useRouter()

    let releaseFirstGuard: (() => void) | undefined
    let firstGuardEntered: (() => void) | undefined
    const entered = new Promise<void>((resolve) => { firstGuardEntered = resolve })
    let pauseNextNavigation = true
    const removeGuard = router.beforeEach(async (to) => {
      if (to.path === '/concurrent' && pauseNextNavigation) {
        pauseNextNavigation = false
        firstGuardEntered!()
        await new Promise<void>((resolve) => { releaseFirstGuard = resolve })
      }
    })

    try {
      const older = router.push('/concurrent')
      await entered
      const newer = router.push('/concurrent')
      await newer
      releaseFirstGuard!()
      await older

      expect(router.currentRoute.value.path).toBe('/concurrent')
    } finally {
      releaseFirstGuard?.()
      removeGuard()
      await clearError()
      vi.unstubAllGlobals()
    }
  })

  it('allows the configured number of redirects', async () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const router = useRouter()
    const prefix = '/redirect-chain/'
    const removeGuard = router.beforeEach((to) => {
      if (!to.path.startsWith(prefix)) { return }
      const redirectCount = Number(to.path.slice(prefix.length))
      if (redirectCount < MAX_REDIRECTS) {
        return `${prefix}${redirectCount + 1}`
      }
    })

    try {
      await router.push(`${prefix}0`)
      expect(router.currentRoute.value.path).toBe(`${prefix}${MAX_REDIRECTS}`)
    } finally {
      removeGuard()
      await clearError()
      vi.unstubAllGlobals()
    }
  })
})
