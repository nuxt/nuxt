import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { test as teardown } from '@playwright/test'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url))

teardown('remove temporary hmr fixture directory', async () => {
  if (!existsSync(fixtureDir)) { return }

  for (let i = 0; i < 5; i++) {
    try {
      await rm(fixtureDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 500 })
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  console.warn(`[teardown] Could not remove ${fixtureDir} — file handles may still be held by a dev server process.`)
})
