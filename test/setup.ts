import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import fs from 'fs-extra'

const dir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(dir, 'fixtures')
const tempDir = join(dir, 'fixtures-temp')

export async function setup () {
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir)
  }
  if (fs.existsSync('node_modules/.cache/jiti')) {
    await fs.remove('node_modules/.cache/jiti')
  }
  for (const file of fs.readdirSync('packages/ui-templates/dist/templates')) {
    console.log(file, fs.readFileSync(file, 'utf-8'))
  }
  await fs.copy(fixtureDir, tempDir, {
    filter: src => !src.includes('.cache'),
  })
}

export async function teardown () {
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir)
  }
}
