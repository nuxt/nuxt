import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { test as teardown } from '@playwright/test'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url))

teardown('remove temporary hmr fixture directory', async () => {
  if (existsSync(fixtureDir)) {
    await rm(fixtureDir, { force: true, recursive: true })
  }
})
