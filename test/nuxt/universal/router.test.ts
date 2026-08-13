import { describe, expect, it } from 'vitest'

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
})
