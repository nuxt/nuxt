import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { test as teardown } from '@playwright/test'
import type { TempFixture } from './temp-fixture'
import { tempFixtureDir, tempFixtures } from './temp-fixture'

teardown('remove temporary fixture directories', async () => {
  for (const name of Object.keys(tempFixtures) as TempFixture[]) {
    const fixtureDir = tempFixtureDir(name)
    if (!existsSync(fixtureDir)) { continue }

    let removed = false
    for (let i = 0; i < 5; i++) {
      try {
        await rm(fixtureDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 500 })
        removed = true
        break
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
    if (!removed) {
      console.warn(`[teardown] Could not remove ${fixtureDir}: file handles may still be held by a dev server process.`)
    }
  }
})
