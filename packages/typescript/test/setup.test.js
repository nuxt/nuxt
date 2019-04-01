import { resolve } from 'path'
import { mkdirp, readJSON, writeFile, remove, readFile } from 'fs-extra'
import { defaultTsJsonConfig, setupDefaults } from '@nuxt/typescript'

describe('typescript setup', () => {
  const rootDir = 'tmp'
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  beforeAll(async () => {
    await mkdirp(rootDir)
    await writeFile(tsConfigPath, '{}', 'utf-8')
  })

  test('Create tsconfig.json with defaults', async () => {
    await setupDefaults(tsConfigPath)
    expect(await readJSON(tsConfigPath)).toEqual(defaultTsJsonConfig)
  })

  test('Do not override tsconfig.json', async () => {
    const fooJSON = '{ "foo": 123 }'
    await writeFile(tsConfigPath, fooJSON, 'utf-8')

    await setupDefaults(tsConfigPath)

    expect(await readFile(tsConfigPath, 'utf-8')).toEqual(fooJSON)
  })

  afterAll(async () => {
    await remove(rootDir)
  })
})
