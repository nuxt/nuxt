import { spawn } from 'node:child_process'
import process from 'node:process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterAll, describe, expect, it } from 'vitest'
import { getRandomPort } from 'get-port-please'
import type { Plugin } from 'vite'
import type { NuxtConfig } from 'nuxt/schema'
import { join } from 'pathe'

import { buildFixture } from './utils.ts'

const tmpDir = fileURLToPath(new URL('./.tmp/ssr-styles', import.meta.url))

async function writeApp () {
  await mkdir(join(tmpDir, 'app/components'), { recursive: true })
  await writeFile(join(tmpDir, 'app/app.vue'), [
    '<script setup>import Styled from \'./components/Styled.vue\'</script>',
    '<template><div class="app"><Styled /></div></template>',
    '<style>.app{color:#123456}</style>',
  ].join('\n'))
  await writeFile(join(tmpDir, 'app/components/Styled.vue'), [
    '<script setup>import \'./imported.css\'</script>',
    '<template><p :class="$style.moduleClass" class="plain scoped imported">styled</p></template>',
    '<style>.plain{color:#654321}</style>',
    '<style scoped>.scoped{margin:3px}</style>',
    '<style module>.moduleClass{padding:5px}</style>',
  ].join('\n'))
  await writeFile(join(tmpDir, 'app/components/imported.css'), '.imported{border-width:7px}')
}

async function build (overrides: NuxtConfig = {}, plugins: Plugin[] = []) {
  const ssrTransforms: string[] = []
  const recorder: Plugin = {
    name: 'record-ssr-transforms',
    transform (_code, id) {
      if (this.environment.name === 'ssr') {
        ssrTransforms.push(id)
      }
    },
  }

  await buildFixture(tmpDir, { ssr: true, features: { inlineStyles: true }, ...overrides, vite: { plugins: [recorder, ...plugins] } })
  return ssrTransforms
}

function rewireClientEntry (wrapperPath: string): Plugin {
  return {
    name: 'test:rewire-client-entry',
    configEnvironment (name) {
      if (name === 'client') {
        return { build: { rolldownOptions: { input: { entry: wrapperPath } } } }
      }
    },
  }
}

async function render () {
  const port = await getRandomPort('127.0.0.1')
  const server = spawn(process.execPath, [join(tmpDir, '.output/server/index.mjs')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  })
  try {
    for (let i = 0; i < 100; i++) {
      const html = await fetch(`http://127.0.0.1:${port}/`).then(r => r.text()).catch(() => undefined)
      if (html) { return html }
      await sleep(100)
    }
    throw new Error('server did not start')
  } finally {
    server.kill()
  }
}

describe('ssr styles', () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('compiles only the style blocks the server build reads', async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await writeApp()

    const ssrTransforms = await build()
    const styleTransforms = ssrTransforms.filter(id => id.includes('type=style'))
    expect(styleTransforms.filter(id => !id.includes('&inline&used&') && !id.includes('.module.'))).toEqual([])

    const html = await render()
    const inlined = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
    for (const css of ['.app{color:#123456}', '.plain{color:#654321}', 'margin:3px', 'padding:5px', 'border-width:7px']) {
      expect(inlined).toContain(css)
    }
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/)
    expect(html).toMatch(/<p class="[^"]*_moduleClass_/)
  }, 240 * 1000)

  it.each([false, true])('inlines global CSS when a module rewires the client entry (asyncEntry: %s)', async (asyncEntry) => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'app'), { recursive: true })
    await mkdir(join(tmpDir, 'app/assets'), { recursive: true })
    await writeFile(join(tmpDir, 'app/app.vue'), '<template><div class="rewired">app</div></template>')
    await writeFile(join(tmpDir, 'app/assets/main.css'), '.rewired{color:#abcdef}')
    await writeFile(join(tmpDir, 'app/entry-wrapper.mjs'), 'import \'#app/entry\'')

    await build(
      { experimental: { asyncEntry }, css: ['~/assets/main.css'] },
      [rewireClientEntry(join(tmpDir, 'app/entry-wrapper.mjs'))],
    )

    const html = await render()
    const inlined = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
    expect(inlined).toContain('.rewired{color:#abcdef}')
  }, 240 * 1000)
})
