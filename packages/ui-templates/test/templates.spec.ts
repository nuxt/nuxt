import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { format } from 'prettier'
import { HtmlValidate } from 'html-validate'

const distDir = fileURLToPath(new URL('../node_modules/.temp/dist/templates', import.meta.url))

describe('template', () => {
  beforeAll(async () => {
    await exec('pnpm', ['build'], {
      throwOnError: true,
      nodeOptions: {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: {
          OUTPUT_DIR: './node_modules/.temp/dist',
        },
      },
    })
  })
  afterAll(() => rm(distDir, { force: true, recursive: true }))

  function formatCss (css: string) {
    return format(css, {
      parser: 'css',
    })
  }

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

  it.each(['error-404', 'error-500', 'loading', 'welcome'])('produces correct output for %s template', async (file) => {
    const contents = readFileSync(`${distDir}/${file}.vue`, 'utf-8')

    const scopedStyle = contents.match(/<style scoped>([\s\S]*)<\/style>/)
    const globalStyle = contents.match(/style: \[[\s\S]*innerHTML: `([\s\S]*)`/)

    expect(await formatCss(scopedStyle?.[1] || '')).toMatchSnapshot()
    expect(await formatCss(globalStyle?.[1] || '')).toMatchSnapshot()

    const { template } = await import(`file://${distDir}/${file}.ts`) as { template: () => string }
    const html = template()
    const { valid, results } = await (validator as any).validateString(html)
    expect.soft(valid).toBe(true)
    expect.soft(results).toEqual([])
  })

  describe('loading template poll', () => {
    async function runPoll (options: { body: string }) {
      const { template } = await import(`file://${distDir}/loading.ts`) as { template: () => string }
      const script = template().match(/<script>([^<]*__NUXT_LOADING__[^<]*)<\/script>/)![1]!

      const delays: number[] = []
      const fetches: Array<{ url: string, init?: { headers?: Record<string, string> } }> = []
      let reloaded = false
      let next: (() => void) | undefined

      const window = {
        fetch: (url: string, init?: { headers?: Record<string, string> }) => {
          fetches.push({ url, init })
          return Promise.resolve({ text: () => Promise.resolve(options.body) })
        },
        location: { href: 'http://localhost:3000/', reload: () => { reloaded = true } },
      }

      runInNewContext(script, {
        window,
        setTimeout: (fn: () => void, delay: number) => {
          delays.push(delay)
          next = fn
        },
      })

      const flush = async () => {
        for (let i = 0; i < 10; i++) {
          await Promise.resolve()
        }
      }

      return {
        delays,
        fetches,
        get reloaded () { return reloaded },
        async advance (times: number) {
          for (let i = 0; i < times; i++) {
            await flush()
            next?.()
          }
          await flush()
        },
      }
    }

    it('backs off while the page is still loading', async () => {
      const poll = await runPoll({ body: '<html>__NUXT_LOADING__</html>' })
      await poll.advance(5)

      expect(poll.delays).toEqual([200, 300, 450, 675, 1000, 1000])
      expect(poll.reloaded).toBe(false)
    })

    it('reloads once the app is ready', async () => {
      const poll = await runPoll({ body: '<html>ready</html>' })
      await poll.advance(1)

      expect(poll.reloaded).toBe(true)
    })

    it('polls as a document request', async () => {
      const poll = await runPoll({ body: '<html>ready</html>' })
      await poll.advance(1)

      expect(poll.fetches).toEqual([{ url: 'http://localhost:3000/', init: { headers: { accept: 'text/html' } } }])
    })
  })
})
