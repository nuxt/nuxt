import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resolve } from 'pathe'
import webpack from 'webpack'
import { logger } from '@nuxt/kit'
import { FriendlyErrorsPlugin } from '../src/plugins/friendly-errors.ts'

describe('FriendlyErrorsPlugin', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(resolve(tmpdir(), 'nuxt-webpack-friendly-errors-'))
    writeFileSync(resolve(root, 'entry.js'), `import './broken.js'\nimport 'missing-package'\n`)
    writeFileSync(resolve(root, 'broken.js'), `export const a = {,,\n`)
  })

  afterAll(() => {
    rmSync(root, { force: true, recursive: true })
  })

  it('logs compilation errors with the module they came from', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const log = vi.spyOn(logger, 'log').mockImplementation(() => {})

    const compiler = webpack({
      context: root,
      entry: './entry.js',
      mode: 'development',
      output: { path: resolve(root, 'dist') },
      plugins: [new FriendlyErrorsPlugin()],
    })
    await new Promise<void>((resolve, reject) => compiler.run(err => err ? reject(err) : resolve()))
    await new Promise(resolve => compiler.close(resolve))

    const errors = error.mock.calls.map(args => args[0])
    const messages = log.mock.calls.map(args => args[0]).filter(Boolean)
    error.mockRestore()
    log.mockRestore()

    expect(errors[0]).toBe('Failed to compile with 2 errors')
    expect(errors.slice(1).sort()).toEqual(['in ./broken.js', 'in ./entry.js'])
    expect(messages).toHaveLength(2)
    expect(messages).toContainEqual(expect.stringContaining('Module parse failed'))
    expect(messages).toContainEqual(expect.stringContaining('Can\'t resolve \'missing-package\''))
  })
})
