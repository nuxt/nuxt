import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { test as teardown } from '@playwright/test'

const fixtureDirs = [
  fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url)),
  fileURLToPath(new URL('../fixtures-temp/hmr-sibling-layer', import.meta.url)),
]

teardown('remove temporary hmr fixture directory', async () => {
  for (const fixtureDir of fixtureDirs) {
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
      console.warn(`[teardown] Could not remove ${fixtureDir} — file handles may still be held by a dev server process.`)
    }
  }
})
