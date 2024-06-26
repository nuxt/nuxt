import { existsSync } from 'node:fs'
import { cp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { dirname, join } from 'pathe'

const dir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(dir, 'fixtures')
const tempDir = join(dir, 'fixtures-temp')

export async function setup () {
  if (existsSync(tempDir)) {
    await rm(tempDir, { force: true, recursive: true })
  }
  await cp(fixtureDir, tempDir, {
    recursive: true,
    filter: src => !src.includes('.cache'),
  })
}

export async function teardown () {
  if (existsSync(tempDir)) {
    await rm(tempDir, { force: true, recursive: true })
  }
}
