import { resolve } from 'path'
import { mkdirp, readJSON, remove, writeJSON } from 'fs-extra'
import { register } from 'ts-node'
import { defaultTsJsonConfig, setup as setupTypeScript } from '@nuxt/typescript'

jest.mock('ts-node')

describe('typescript setup', () => {
  const rootDir = 'tmp'
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  beforeAll(async () => {
    // We're assuming that rootDir provided to setupTypeScript is existing so we create the tested one
    await mkdirp(rootDir)
    await writeJSON(tsConfigPath, {})
    await setupTypeScript(tsConfigPath)
  })

  test('tsconfig.json has been updated with defaults', async () => {
    expect(await readJSON(tsConfigPath)).toEqual(defaultTsJsonConfig)
  })

  test('ts-node has been registered once', async () => {
    // Call setupTypeScript a second time to test guard
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
