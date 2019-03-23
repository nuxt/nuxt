import { resolve } from 'path'
import {
  mkdirp,
  readJSON,
  remove,
  writeFile,
  writeJSON
} from 'fs-extra'
import { register } from 'ts-node'
import { defaultTsJsonConfig, setup as setupTypeScript } from '@nuxt/typescript'

jest.mock('ts-node')

describe('typescript setup', () => {
  const rootDir = 'tmp'
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  beforeAll(async () => {
    // We're assuming that rootDir provided to setupTypeScript is existing so we create the tested one
    await mkdirp(rootDir)
    await setupTypeScript(tsConfigPath)
  })

  test('tsconfig.json has been created with defaults', async () => {
    expect(await readJSON(tsConfigPath)).toEqual(defaultTsJsonConfig)
  })

  test('should not overwrite tsconfig.json if exists', async () => {
    const editedTsJsonConfig = {
      ...defaultTsJsonConfig,
      lib: ['dom', 'es2015']
    }
    await writeJSON(tsConfigPath, editedTsJsonConfig, { spaces: 2 })
    expect(await readJSON(tsConfigPath)).toEqual(editedTsJsonConfig)
  })

  test('should throw an error after reading invalid json', async () => {
    await writeFile(tsConfigPath, '{"invalidJson": "test"')
    await expect(readJSON(tsConfigPath)).rejects.toThrow()
  })

  test('ts-node has been registered once', async () => {
    // Call setupTypeScript a second time to test guard
    await remove(tsConfigPath)
    await setupTypeScript(tsConfigPath)

    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith({
      project: tsConfigPath,
      compilerOptions: {
        module: 'commonjs'
      }
    })
  })

  afterAll(async () => {
    // Clean workspace by removing the temporary folder (and the generated tsconfig.json at the same time)
    await remove(rootDir)
  })
})
