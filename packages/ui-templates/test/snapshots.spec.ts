import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { format } from 'prettier'

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

  it.each(['error-404.vue', 'error-500.vue', 'error-dev.vue', 'loading.vue', 'welcome.vue'])('correctly outputs style blocks for %s', async (file) => {
    const contents = readFileSync(`${distDir}/${file}`, 'utf-8')

    const scopedStyle = contents.match(/<style scoped>([\s\S]*)<\/style>/)
    const globalStyle = contents.match(/style: \[[\s\S]*children: `([\s\S]*)`/)

    expect(await formatCss(scopedStyle?.[1] || '')).toMatchSnapshot()
    expect(await formatCss(globalStyle?.[1] || '')).toMatchSnapshot()
  })
})
