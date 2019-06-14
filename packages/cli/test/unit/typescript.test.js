import { resolve } from 'path'
import { mkdirp, writeFile, remove } from 'fs-extra'
import { register } from 'ts-node'
import { detectTypeScript, setGuard } from '../../src/utils/typescript'

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

  beforeEach(() => {
    register.mockReset()
    setGuard(false)
  })

  test('detectTypeScript detects and registers runtime', async () => {
    await detectTypeScript(rootDir)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith({
      project: tsConfigPath,
      compilerOptions: {
        module: 'commonjs'
      }
    })
  })

  test('multiple detectTypeScript calls registers runtime only once', async () => {
    await detectTypeScript(rootDir)
    await detectTypeScript(rootDir)
    expect(register).toHaveBeenCalledTimes(1)
  })

  test('detectTypeScript skips rootDir without tsconfig.json', async () => {
    await detectTypeScript(rootDir2)
    expect(register).toHaveBeenCalledTimes(0)
  })

  afterAll(async () => {
    await remove(rootDir)
    await remove(rootDir2)
  })
})
