import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { format } from 'prettier'

const distDir = fileURLToPath(new URL('../dist/templates', import.meta.url))

describe('template', () => {
  beforeAll(async () => {
    await execaCommand('pnpm build', {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
    })
  })

  function formatCss (css: string) {
    return format(css, {
      parser: 'css',
    })
  }

  it.each(['error-404.vue', 'error-500.vue', 'error-dev.vue', 'loading.vue', 'welcome.vue'])('correctly outputs style blocks for %s', async (file) => {
    const contents = await fsp.readFile(`${distDir}/${file}`, 'utf-8')

    const scopedStyle = contents.match(/<style scoped>([\s\S]*)<\/style>/)
    const globalStyle = contents.match(/style: \[[\s\S]*children: `([\s\S]*)`/)

    expect(await formatCss(scopedStyle?.[1] || '')).toMatchSnapshot()
    expect(await formatCss(globalStyle?.[1] || '')).toMatchSnapshot()
  })
})
