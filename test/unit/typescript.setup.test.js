import { resolve } from 'path'
import { exists, mkdirp, readJSON, remove } from 'fs-extra'
import { register } from 'ts-node'
import { setup as setupTypeScript } from '@nuxt/typescript'

jest.mock('ts-node')

describe('typescript setup', () => {
  const rootDir = 'tmp'
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  beforeAll(() => {
    setupTypeScript(tsConfigPath)
  })

  test('tsconfig.json has been generated if missing', async () => {
    // We're assuming that rootDir provided to setupTypeScript is existing so we create the tested one
    await mkdirp(rootDir)

    expect(await exists(tsConfigPath)).toBe(true)
    expect(await readJSON(tsConfigPath)).toEqual({
      extends: '@nuxt/typescript',
      compilerOptions: {
        baseUrl: '.',
        types: [
          '@types/node',
          '@nuxt/vue-app'
        ]
      }
    })

    // Clean workspace by removing the temporary folder (and the generated tsconfig.json at the same time)
    await remove(tsConfigPath)
  })

  test('ts-node has been registered', () => {
    expect(register).toHaveBeenCalledWith({
      project: tsConfigPath
    })
  })
})
