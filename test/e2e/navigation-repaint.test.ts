import type { Router } from 'vue-router'
import { expect, fixtureDir, test } from './test-utils'

test.use({
  reducedMotion: 'no-preference',
  nuxt: {
    rootDir: fixtureDir('minimal-pages'),
    nuxtConfig: {
      experimental: { viewTransition: true, navigationRepaint: true },
    },
  },
})

// https://github.com/nuxt/nuxt/issues/36768
test('renders the next page without the repaint timeout during a view transition', async ({ page, goto }) => {
  await goto('/')
  await page.evaluate(() => new Promise<void>(resolve => requestIdleCallback(() => resolve())))

  const durations = await page.evaluate(async () => {
    const nuxtApp = window.useNuxtApp!()
    const router = nuxtApp.$router as Router
    const durations: number[] = []
    let transition: ViewTransition | undefined
    const unhook = nuxtApp.hook('page:view-transition:start', (currentTransition) => {
      transition = currentTransition
      const startedAt = performance.now()
      currentTransition.updateCallbackDone.then(() => durations.push(performance.now() - startedAt))
    })

    try {
      // Warm both routes before measuring, so loading their chunks is excluded.
      for (let i = 0; i < 4; i++) {
        for (const path of ['/a', '/']) {
          await router.push(path)
          await transition?.finished
        }
        if (i === 0) { durations.length = 0 }
      }
      return durations
    } finally {
      unhook()
    }
  })

  await expect(page.getByText('Hello World!')).toBeVisible()
  expect(durations).toHaveLength(6)
  // The old guard always waits at least 100ms because rendering is paused.
  // Use the median of warmed navigations to tolerate occasional slow frames.
  durations.sort((a, b) => a - b)
  expect(durations[Math.floor(durations.length / 2)]).toBeLessThan(100)
})
