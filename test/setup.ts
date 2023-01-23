import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'fs-extra'

const dir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(dir, 'fixtures')
const tempDir = join(dir, 'fixtures-temp')

export async function setup () {
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir)
  }
  await fs.copy(fixtureDir, tempDir)
}

export async function teardown () {
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir)
  }
}
