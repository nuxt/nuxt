import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { test as teardown } from '@playwright/test'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url))

teardown('remove temporary hmr fixture directory', async () => {
  if (!existsSync(fixtureDir)) { return }

  // try to work around windows flakiness with file locks
  const maxRetries = 5
  for (let i = 0; i < maxRetries; i++) {
    try {
      await rm(fixtureDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 500 })
      return
    } catch (err: unknown) {
      if (i === maxRetries - 1) { throw err }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
})
