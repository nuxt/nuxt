import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { format } from 'prettier'
import { createJiti } from 'jiti'
// @ts-expect-error types not valid for bundler resolution
import { HtmlValidate } from 'html-validate'

const distDir = fileURLToPath(new URL('../node_modules/.temp/dist/templates', import.meta.url))

describe('template', () => {
  beforeAll(async () => {
    await execaCommand('pnpm build', {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        OUTPUT_DIR: './node_modules/.temp/dist',
      },
    })
  })
  afterAll(() => rm(distDir, { force: true, recursive: true }))

  function formatCss (css: string) {
    return format(css, {
      parser: 'css',
    })
  }

  const jiti = createJiti(import.meta.url)

  const validator = new HtmlValidate({
    extends: [
      'html-validate:document',
      'html-validate:recommended',
      'html-validate:standard',
    ],
    rules: {
    //
      'svg-focusable': 'off',
      'no-unknown-elements': 'error',
      // Conflicts or not needed as we use prettier formatting
      'void-style': 'off',
      'no-trailing-whitespace': 'off',
      // Conflict with Nuxt defaults
      'require-sri': 'off',
      'attribute-boolean-style': 'off',
      'doctype-style': 'off',
      // Unreasonable rule
      'no-inline-style': 'off',
    },
  })

  it.each(['error-404', 'error-500', 'error-dev', 'loading', 'welcome'])('produces correct output for %s template', async (file) => {
    const contents = readFileSync(`${distDir}/${file}.vue`, 'utf-8')

    const scopedStyle = contents.match(/<style scoped>([\s\S]*)<\/style>/)
    const globalStyle = contents.match(/style: \[[\s\S]*children: `([\s\S]*)`/)

    expect(await formatCss(scopedStyle?.[1] || '')).toMatchSnapshot()
    expect(await formatCss(globalStyle?.[1] || '')).toMatchSnapshot()

    const { template } = await jiti.import(`file://${distDir}/${file}.ts`) as { template: () => string }
    const html = template()
    const { valid, results } = await (validator as any).validateString(html)
    expect.soft(valid).toBe(true)
    expect.soft(results).toEqual([])
  })
})
