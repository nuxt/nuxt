import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'fs-extra'
import { execaCommand } from 'execa'

const dir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(dir, 'fixtures')
const tempDir = join(dir, 'fixtures-temp')

export async function setup () {
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir)
  }
  await fs.copy(fixtureDir, tempDir, {
    filter: src => !src.includes('.nuxt') && !src.includes('.cache')
  })
  await execaCommand(`pnpm nuxi prepare ${tempDir}`)
}

export async function teardown () {
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir)
  }
}
