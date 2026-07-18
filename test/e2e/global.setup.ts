import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cp, rm } from 'node:fs/promises'
import { test as setup } from '@playwright/test'

const fixtures = [
  {
    sourceDir: fileURLToPath(new URL('../fixtures/hmr', import.meta.url)),
    fixtureDir: fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url)),
  },
  {
    sourceDir: fileURLToPath(new URL('../fixtures/hmr-sibling-layer', import.meta.url)),
    fixtureDir: fileURLToPath(new URL('../fixtures-temp/hmr-sibling-layer', import.meta.url)),
  },
]

setup('create temporary hmr fixture directory', async () => {
  for (const { sourceDir, fixtureDir } of fixtures) {
    if (existsSync(fixtureDir)) {
      await rm(fixtureDir, { force: true, recursive: true })
    }
    await cp(sourceDir, fixtureDir, {
      recursive: true,
      filter: (src) => {
        return !src.includes('.cache') && !src.endsWith('.sock') && !src.includes('.output') && !src.includes('.nuxt-')
      },
    })
  }
})
