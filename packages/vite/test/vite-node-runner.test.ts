import { describe, expect, it } from 'vitest'

import { formatViteError } from '../src/vite-node-runner.ts'

describe('formatViteError', () => {
  it('includes original message when reason is not provided', () => {
    const { message, stack } = formatViteError({
      name: 'TransformError',
      message: 'Tailwind plugin exploded',
      plugin: 'tailwindcss',
      id: '/tmp/nuxt.config.ts',
    }, '/tmp/nuxt.config.ts')

    expect(message).toContain('Tailwind plugin exploded')
    expect(stack).toContain('Tailwind plugin exploded')
  })

  it('does not emit undefined location fragments', () => {
    const { message } = formatViteError({
      code: 'PARSE_ERROR',
      message: 'Unexpected token',
      loc: {
        file: '/tmp/app.vue',
        line: 'undefined',
        column: 'undefined',
      },
    }, '/tmp/app.vue')

    expect(message).not.toContain('undefined:undefined')
  })
})
