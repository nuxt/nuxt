import { describe, expect, it } from 'vitest'
import { formatViteError } from '../src/utils/format-vite-error'

describe('formatViteError', () => {
  it('uses message when reason is absent (plugin errors)', () => {
    const errorData = {
      code: 'VITE_ERROR',
      id: '/project/app.vue',
      message: 'Tailwind config error: invalid theme',
      stack: 'Error: Tailwind config error...',
    }
    const { message } = formatViteError(errorData, '/project/app.vue')
    expect(message).toContain('Tailwind config error: invalid theme')
    expect(message).toContain('[vite-node]')
  })

  it('prefers reason over message when both present (Rollup-style)', () => {
    const errorData = {
      code: 'PARSE_ERROR',
      reason: 'Unexpected token',
      message: 'Parse error',
      id: '/project/foo.ts',
    }
    const { message } = formatViteError(errorData, '/project/foo.ts')
    expect(message).toContain('Unexpected token')
    expect(message).not.toContain('Parse error')
  })

  it('includes plugin name when present', () => {
    const errorData = {
      code: 'VITE_ERROR',
      plugin: 'tailwindcss',
      message: 'Invalid config',
      id: '/project/app.css',
    }
    const { message } = formatViteError(errorData, '/project/app.css')
    expect(message).toContain('[plugin:tailwindcss]')
    expect(message).toContain('Invalid config')
  })

  it('includes loc when present', () => {
    const errorData = {
      code: 'VITE_ERROR',
      message: 'Syntax error',
      loc: { file: '/project/bar.ts', line: 10, column: 5 },
    }
    const { message } = formatViteError(errorData, '/project/bar.ts')
    expect(message).toContain('bar.ts')
    expect(message).toContain('10:5')
  })

  it('includes frame when present', () => {
    const errorData = {
      code: 'VITE_ERROR',
      message: 'Unexpected <',
      frame: '  <div>\n    ^',
    }
    const { message } = formatViteError(errorData, '/project/x.vue')
    expect(message).toContain('<pre>')
    expect(message).toContain('&lt;div&gt;')
    expect(message).toContain('Unexpected <')
  })

  it('returns empty error text when neither reason nor message', () => {
    const errorData = {
      code: 'VITE_ERROR',
      id: '/project/empty.vue',
    }
    const { message } = formatViteError(errorData, '/project/empty.vue')
    expect(message).toContain('[vite-node]')
    expect(message).toContain('[VITE_ERROR]')
    // loc is derived from id; full path may be shortened to ./path if cwd is replaced
    expect(message).toMatch(/empty\.vue/)
  })
})
