import { resolve } from 'path'
import { mkdirp, writeFile, remove } from 'fs-extra'
import { register } from 'ts-node'
import { detectTypeScript } from '../../src/utils/typescript'

jest.mock('ts-node')

describe('Typescript Support', () => {
  const rootDir = 'tmp'
  const rootDir2 = 'tmp2'
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  beforeAll(async () => {
    await mkdirp(rootDir)
    await mkdirp(rootDir2)
    await writeFile(tsConfigPath, '{}', 'utf-8')
  })

  test('detectTypeScript detects and registers runtime', async () => {
    register.mockReset()
    await detectTypeScript(rootDir)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith({
      project: tsConfigPath,
      compilerOptions: {
        module: 'commonjs'
      }
    })
  })

  test('detectTypeScript skips rootDir without tsconfig.json', async () => {
    register.mockReset()
    await detectTypeScript(rootDir2)
    expect(register).toHaveBeenCalledTimes(0)
  })

  afterAll(async () => {
    await remove(rootDir)
    await remove(rootDir2)
  })
})
