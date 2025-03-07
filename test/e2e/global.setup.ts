import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cp, rm } from 'node:fs/promises'
import { test as setup } from '@playwright/test'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url))
const sourceDir = fileURLToPath(new URL('../fixtures/hmr', import.meta.url))

setup('create temporary hmr fixture directory', async () => {
  if (existsSync(fixtureDir)) {
    await rm(fixtureDir, { force: true, recursive: true })
  }
  await cp(sourceDir, fixtureDir, {
    recursive: true,
    filter: (src) => {
      return !src.includes('.cache') && !src.endsWith('.sock') && !src.includes('.output') && !src.includes('.nuxt-')
    },
  })
})
