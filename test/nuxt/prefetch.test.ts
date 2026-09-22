/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { usePrefetchScheduler } from '#app/internal/prefetch-scheduler'
import type { PrefetchScheduler } from '#app/internal/prefetch'

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function scheduleProbe (scheduler: PrefetchScheduler, key: string, started: string[]) {
  scheduler.schedule({
    key,
    priority: 'payload',
    scope: 'app',
    run: (signal) => {
      if (!signal.aborted) { started.push(key) }
    },
  })
}

describe('prefetch scheduler navigation state', () => {
  let scheduler: PrefetchScheduler
  let started: string[]

  beforeEach(async () => {
    const nuxtApp = useNuxtApp()
    delete nuxtApp._prefetch
    scheduler = usePrefetchScheduler(nuxtApp)
    started = []
    await useRouter().push('/')
    await tick()
  })

  afterEach(async () => {
    await useRouter().push('/')
  })

  it('should hold prefetch work while a navigation is in progress', async () => {
    const router = useRouter()
    let release: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const removeGuard = router.beforeEach(() => blocked)

    const navigation = router.push('/index')
    await tick()

    scheduleProbe(scheduler, 'payload:/held', started)
    await tick()
    expect(started).toEqual([])

    release!()
    await navigation
    await tick()

    expect(started).toEqual(['payload:/held'])
    removeGuard()
  })

  it('should resume prefetch work after a navigation is aborted', async () => {
    const router = useRouter()
    const removeGuard = router.beforeEach(() => false)

    await router.push('/index')
    await tick()

    scheduleProbe(scheduler, 'payload:/after-abort', started)
    await tick()

    expect(started).toEqual(['payload:/after-abort'])
    removeGuard()
  })
})
