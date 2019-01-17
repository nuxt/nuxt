import { resolve } from 'path'
import { mkdirp, exists, readJson, remove } from 'fs-extra'
import { register } from 'ts-node'
import { generateTsConfigIfMissing, registerTsNode } from '../../distributions/nuxt-ts/src'

jest.mock('ts-node')

describe('nuxt-ts', () => {
  test('generate tsconfig.json if missing', async () => {
    const rootDir = 'tmp'

    // We're assuming that rootDir provided to generateTsConfigIfMissing is existing so we create the tested one
    await mkdirp(rootDir)

    generateTsConfigIfMissing(rootDir)

    const tsConfigPath = resolve(rootDir, 'tsconfig.json')

    expect(await exists(tsConfigPath)).toBe(true)
    expect(await readJson(tsConfigPath)).toEqual({
      extends: 'nuxt-ts',
      compilerOptions: {
        baseUrl: '.'
      }
    })

    // Clean workspace by removing the temporary folder (and the generated tsconfig.json at the same time)
    await remove(rootDir)
  })

  test('register ts-node', () => {
    registerTsNode()
    expect(register).toHaveBeenCalled()
  })
})
