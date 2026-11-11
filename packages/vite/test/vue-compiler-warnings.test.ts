import { mkdtemp, realpath, rm, utimes, writeFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { ErrorReport } from 'my-bad'
import type { ProblemMeta } from 'my-bad/channel'
import { createLogger, createServer } from 'vite'
import { resolveModulePath } from 'exsolve'
import vuePlugin from '@vitejs/plugin-vue'

import { VueCompilerWarningsPlugin, createVueWarningReport, createVueWarningStore, parseVueCompilerWarning } from '../src/vue-compiler-warnings.ts'

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-compiler-warnings-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

const NESTING = '<p> cannot be child of <p>, according to HTML specifications. This can cause hydration errors or potentially disrupt future functionality.'

describe('parseVueCompilerWarning', () => {
  it('reads the position from the code frame of a template warning', () => {
    const frame = '1  |  <template>\n2  |    <p><p>nested</p></p>\n   |       ^^^^^^^^^^^^^\n3  |  </template>'
    expect(parseVueCompilerWarning(`${NESTING}\n${frame}`, '/app/pages/index.vue')).toEqual({ file: '/app/pages/index.vue', message: NESTING, line: 2, column: 6, frame })
  })

  it('drops the prefix and file name `@vue/compiler-sfc` prints', () => {
    const printed = '\x1B[1m\x1B[33m[@vue/compiler-sfc]\x1B[0m\x1B[33m withDefaults() is unnecessary when using destructure with defineProps().\nReactive destructure will be disabled when using withDefaults().\n\n/app/pages/index.vue\n2  |  const { a } = withDefaults(defineProps<{ a?: string }>(), { a: \'x\' })\n   |                ^^^^^^^^^^^^\x1B[0m\n'
    expect(parseVueCompilerWarning(printed, '/app/pages/index.vue')).toEqual({
      file: '/app/pages/index.vue',
      message: 'withDefaults() is unnecessary when using destructure with defineProps().\nReactive destructure will be disabled when using withDefaults().',
      line: 2,
      column: 15,
      frame: '2  |  const { a } = withDefaults(defineProps<{ a?: string }>(), { a: \'x\' })\n   |                ^^^^^^^^^^^^',
    })
  })

  it('moves a position marked past the end of a line to the start of the next', () => {
    expect(parseVueCompilerWarning('boom\n1  |  <template>\n   |             ^\n2  |  <div />', '/app.vue')).toMatchObject({ line: 2, column: 1 })
    expect(parseVueCompilerWarning('boom\n1  |  <template>\n   |            ^\n2  |  <div />', '/app.vue')).toMatchObject({ line: 1, column: 11 })
  })

  it('keeps a warning without a code frame for the whole file', () => {
    const printed = '\x1B[1m\x1B[33m[@vue/compiler-sfc]\x1B[0m\x1B[33m the >>> and /deep/ combinators have been deprecated. Use :deep() instead.\x1B[0m\n'
    expect(parseVueCompilerWarning(printed, '/app.vue')).toEqual({ file: '/app.vue', message: 'the >>> and /deep/ combinators have been deprecated. Use :deep() instead.' })
  })

  it('reads the link of a deprecation', () => {
    expect(parseVueCompilerWarning('(deprecation COMPILER_V_BIND_SYNC) .sync is removed\n  Details: https://v3-migration.vuejs.org/breaking-changes/v-model.html', '/app.vue'))
      .toEqual({ file: '/app.vue', message: '(deprecation COMPILER_V_BIND_SYNC) .sync is removed', docs: 'https://v3-migration.vuejs.org/breaking-changes/v-model.html' })
  })
})

describe('createVueWarningStore', () => {
  const warning = (message: string, file = '/app.vue') => ({ file, message, line: 1, column: 1 })

  it('replaces the warnings of a module compiled from new code', () => {
    const store = createVueWarningStore()
    expect([...store.update('/app.vue', { file: '/app.vue', code: 'a', warnings: [warning('one')] })]).toHaveLength(1)
    store.update('/app.vue', { file: '/app.vue', code: 'b', warnings: [warning('two')] })
    expect(store.warnings.map(w => w.message)).toEqual(['two'])
    store.update('/app.vue', { file: '/app.vue', code: 'c', warnings: [] })
    expect(store.warnings).toEqual([])
  })

  it('keeps the warnings of a module compiled again from the same code', () => {
    const store = createVueWarningStore()
    store.update('/app.vue', { file: '/app.vue', code: 'a', warnings: [warning('once per process')] })
    expect(store.update('/app.vue', { file: '/app.vue', code: 'a', warnings: [] }).size).toBe(0)
    expect(store.warnings.map(w => w.message)).toEqual(['once per process'])
  })

  it('only counts a warning as new when no module of its file has it', () => {
    const store = createVueWarningStore()
    store.update('/app.vue\0hmr', { file: '/app.vue', code: undefined, warnings: [warning('one')] })
    expect(store.update('/app.vue', { file: '/app.vue', code: 'a', warnings: [warning('one'), warning('two')] })).toEqual(new Set([expect.stringContaining('two')]))
    expect(store.warnings.map(w => w.message)).toEqual(['one', 'two'])
  })

  it('forgets blocks that are no longer imported, and deleted files', () => {
    const store = createVueWarningStore()
    const style = '/app.vue?vue&type=style&index=0&lang.css'
    store.update(style, { file: '/app.vue', code: '.a{}', block: { id: style, environment: 'client' }, warnings: [warning('style')] })
    store.update('/other.vue', { file: '/other.vue', code: 'a', warnings: [warning('other', '/other.vue')] })
    store.prune(id => id !== style)
    expect(store.warnings.map(w => w.message)).toEqual(['other'])
    expect(store.remove('/other.vue')).toBe(true)
    expect(store.remove('/other.vue')).toBe(false)
    expect(store.warnings).toEqual([])
  })
})

describe('createVueWarningReport', () => {
  it('builds a template warning with a snippet from its code frame', () => {
    const tip = `${NESTING}\n1  |  <template>\n2  |    <p><p>nested</p></p>\n   |       ^^^^^^^^^^^^^\n3  |  </template>`
    const report = createVueWarningReport(parseVueCompilerWarning(tip, '/app/Report.vue'), '/app')
    expect(report).toMatchObject({ kind: 'warning', name: 'Vue', message: NESTING, frames: [{ file: '/app/Report.vue', line: 2, column: 6, type: 'app', snippet: { start: 1, lines: ['<template>', '  <p><p>nested</p></p>', '</template>'] } }] })
  })

  it('builds a warning for the whole file, with an id per file', () => {
    const message = 'the >>> and /deep/ combinators have been deprecated. Use :deep() instead.'
    const [a, b] = ['/app/A.vue', '/app/B.vue'].map(file => createVueWarningReport({ file, message }, '/app'))
    expect(a).toMatchObject({ kind: 'warning', message, frames: [{ file: '/app/A.vue', type: 'app' }] })
    expect(a!.frames[0]).not.toHaveProperty('line')
    expect(a!.id).not.toBe(b!.id)
  })

  it('links the docs of a deprecation', () => {
    expect(createVueWarningReport({ file: '/app/A.vue', message: '.sync is removed', docs: 'https://v3-migration.vuejs.org' }, '/app')).toMatchObject({ docsUrl: 'https://v3-migration.vuejs.org' })
  })
})

function createNuxt () {
  const hooks: Record<string, Array<() => void>> = {}
  return {
    options: { rootDir: tmpDir },
    hook: (name: string, fn: () => void) => { (hooks[name] ||= []).push(fn) },
    close: () => hooks.close?.forEach(fn => fn()),
  } as unknown as Nuxt & { close: () => void }
}

/** The problem sets published, in order. */
function createSink () {
  const sets: Array<{ source: string, reports: ErrorReport[], meta?: ProblemMeta }> = []
  return {
    sets,
    setProblems: (source: string, reports: ErrorReport[], meta?: ProblemMeta) => { sets.push({ source, reports, meta }) },
    clearProblems: () => {},
  }
}

/** A stand-in for `@vitejs/plugin-vue` whose transform warns with the message `warningFor` returns. */
function fakeVuePlugin (warningFor: (code: string) => string | undefined) {
  const sink = createSink()
  const vue = {
    name: 'vite:vue',
    transform: {
      handler (this: { warn: (log: unknown) => void }, code: string, _id: string) {
        const message = warningFor(code)
        if (message) {
          this.warn({ message })
        }
        return Promise.resolve({ code })
      },
    },
  }
  VueCompilerWarningsPlugin(createNuxt(), vue as any, sink)
  return {
    sink,
    transform: (code: string, id: string, environment: string) => vue.transform.handler.call({ warn: () => {}, environment: { name: environment } }, code, id),
  }
}

async function startServer () {
  const nuxt = createNuxt()
  const sink = createSink()
  const vue = vuePlugin()
  const handleHotUpdate = () => vue.handleHotUpdate as (ctx: unknown) => Promise<unknown>
  const logger = createLogger('warn')
  const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  onTestFinished(() => consoleWarn.mockRestore())
  const server = await createServer({
    root: tmpDir,
    configFile: false,
    customLogger: logger,
    resolve: { alias: { vue: resolveModulePath('vue', { from: import.meta.url }) } },
    plugins: [vue, VueCompilerWarningsPlugin(nuxt, vue, sink)],
    server: { middlewareMode: true, ws: false, watch: null },
  })
  onTestFinished(async () => {
    nuxt.close()
    await server.close()
  })
  return {
    server,
    sets: sink.sets,
    /** Run the Vue plugin's handling of a changed file, which compiles its script. */
    hotUpdate: (file: string, content: string) => handleHotUpdate()({ file, modules: [...server.environments.client.moduleGraph.getModulesByFile(file) || []], read: () => content, server, timestamp: Date.now() }),
    /** Terminal output of the warnings, through Vite's logger and `console.warn`. */
    printed: () => [...loggerWarn.mock.calls, ...consoleWarn.mock.calls].map(call => String(call[0])),
  }
}

describe('VueCompilerWarningsPlugin', () => {
  it('publishes the warnings of an SFC as a problem set, replacing them on recompile', async () => {
    const file = join(tmpDir, 'Nested.vue')
    await writeFile(file, [
      '<script setup lang="ts">',
      'const { a } = withDefaults(defineProps<{ a?: string }>(), { a: \'x\' })',
      '</script>',
      '<template>',
      '  <p><p>{{ a }}</p></p>',
      '</template>',
      '<style scoped>',
      '.a >>> .b { color: red }',
      '</style>',
    ].join('\n'))
    const { server, sets, printed } = await startServer()
    const client = server.environments.client

    await client.transformRequest('/Nested.vue')
    await client.transformRequest('/Nested.vue?vue&type=style&index=0&scoped=true&lang.css')
    await vi.waitFor(() => expect(sets).toHaveLength(1))

    expect(sets[0]).toMatchObject({ source: 'vue:compiler', meta: { label: 'Vue' } })
    expect(sets[0]!.reports.map(report => [report.kind, report.message.split('\n')[0], report.frames[0]?.line, !!report.frames[0]?.snippet])).toEqual([
      ['warning', 'the >>> and /deep/ combinators have been deprecated. Use :deep() instead.', undefined, false],
      ['warning', 'withDefaults() is unnecessary when using destructure with defineProps().', 2, true],
      ['warning', NESTING, 5, true],
    ])
    expect(printed()).toHaveLength(3)

    await server.environments.ssr.transformRequest('/Nested.vue')
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(printed()).toHaveLength(3)
    expect(sets).toHaveLength(1)

    await writeFile(file, '<template>\n  <p>{{ 1 }}</p>\n</template>\n<style scoped>\n.a :deep(.b) { color: red }\n</style>\n')
    client.moduleGraph.invalidateAll()
    server.environments.ssr.moduleGraph.invalidateAll()
    await client.transformRequest('/Nested.vue')
    await server.environments.ssr.transformRequest('/Nested.vue')
    await client.transformRequest('/Nested.vue?vue&type=style&index=0&scoped=true&lang.css')
    await vi.waitFor(() => expect(sets.at(-1)).toMatchObject({ source: 'vue:compiler', reports: [] }))
    expect(printed()).toHaveLength(3)
  })

  it('prints a warning raised by a hot update once', async () => {
    const file = join(tmpDir, 'Hot.vue')
    const updated = '<script setup lang="ts">\nconst { a } = withDefaults(defineProps<{ a?: string }>(), { a: \'x\' })\n</script>\n<template>{{ a }}</template>\n'
    await writeFile(file, '<template>{{ 1 }}</template>\n')
    const { server, sets, printed, hotUpdate } = await startServer()
    const client = server.environments.client

    await client.transformRequest('/Hot.vue')
    await writeFile(file, updated)
    await hotUpdate(file, updated)
    client.moduleGraph.invalidateAll()
    await client.transformRequest('/Hot.vue')

    await vi.waitFor(() => expect(sets.at(-1)).toMatchObject({ reports: [{ message: expect.stringContaining('withDefaults() is unnecessary') }] }))
    expect(printed()).toEqual([expect.stringContaining('withDefaults() is unnecessary')])
  })

  it('drops the warnings of a style block removed from its SFC', async () => {
    const file = join(tmpDir, 'Styled.vue')
    await writeFile(file, '<template>\n  <div class="a" />\n</template>\n<style scoped>\n.a >>> .b { color: red }\n</style>\n')
    const { server, sets } = await startServer()
    const client = server.environments.client

    await client.transformRequest('/Styled.vue')
    await client.transformRequest('/Styled.vue?vue&type=style&index=0&scoped=true&lang.css')
    await vi.waitFor(() => expect(sets.at(-1)).toMatchObject({ reports: [{ message: expect.stringContaining('>>>') }] }))

    await writeFile(file, '<template>\n  <div class="a" />\n</template>\n')
    client.moduleGraph.invalidateAll()
    await client.transformRequest('/Styled.vue')
    await vi.waitFor(() => expect(sets.at(-1)).toMatchObject({ reports: [] }))
  })

  it('publishes a warning again when its snippet changes', async () => {
    const file = join(tmpDir, 'Snippet.vue')
    await writeFile(file, '<template>\n  <a href="/">\n    <a href="/a">one</a>\n  </a>\n</template>\n')
    const { server, sets } = await startServer()
    const client = server.environments.client

    await client.transformRequest('/Snippet.vue')
    await vi.waitFor(() => expect(sets).toHaveLength(1))

    await writeFile(file, '<template>\n  <a href="/">\n    <a href="/a">two</a>\n  </a>\n</template>\n')
    client.moduleGraph.invalidateAll()
    await client.transformRequest('/Snippet.vue')
    await vi.waitFor(() => expect(sets).toHaveLength(2))
    expect(sets[1]!.reports[0]!.id).toBe(sets[0]!.reports[0]!.id)
    expect(sets[1]!.reports[0]!.frames[0]!.snippet!.lines).toContain('    <a href="/a">two</a>')
  })

  it('ignores the warnings of a compile that a compile of newer code overtook', async () => {
    const sink = createSink()
    const resolvers = new Map<string, () => void>()
    const vue = {
      name: 'vite:vue',
      transform: {
        handler (this: { warn: (log: unknown) => void }, code: string, _id: string) {
          this.warn({ message: `warning for ${code}` })
          return new Promise(resolve => resolvers.set(code, () => resolve({ code })))
        },
      },
    }
    VueCompilerWarningsPlugin(createNuxt(), vue as any, sink)
    const context = { warn: () => {}, environment: { name: 'client' } }
    const transform = (code: string) => vue.transform.handler.call(context, code, join(tmpDir, 'Race.vue'))

    const older = transform('old')
    const newer = transform('new')
    resolvers.get('new')!()
    await newer
    resolvers.get('old')!()
    await older

    await vi.waitFor(() => expect(sink.sets).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(sink.sets.map(set => set.reports.map(report => report.message))).toEqual([['warning for new']])
  })

  it('keeps the warnings of each environment apart when they compile different code', async () => {
    const file = join(tmpDir, 'Environments.vue')
    await writeFile(file, '<template />\n')
    const { sink, transform } = fakeVuePlugin(code => code === 'client' ? 'client only' : undefined)

    await transform('client', file, 'client')
    await transform('ssr', file, 'ssr')

    await vi.waitFor(() => expect(sink.sets).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(sink.sets.at(-1)!.reports.map(report => report.message)).toEqual(['client only'])
  })

  it('forgets the warnings another environment compiled from an older version of the file', async () => {
    const file = join(tmpDir, 'Versions.vue')
    await writeFile(file, '<template />\n')
    const { sink, transform } = fakeVuePlugin(code => code === 'old' ? 'from the old version' : undefined)

    await transform('old', file, 'ssr')
    await vi.waitFor(() => expect(sink.sets.at(-1)?.reports).toHaveLength(1))

    await utimes(file, new Date(), new Date(Date.now() + 10_000))
    await transform('new', file, 'client')
    await vi.waitFor(() => expect(sink.sets.at(-1)?.reports).toEqual([]))
  })

  it('ignores the warnings of a compile that finishes after its file was deleted', async () => {
    const file = join(tmpDir, 'Unlinked.vue')
    await writeFile(file, '<template />\n')
    const sink = createSink()
    const nuxt = createNuxt()
    onTestFinished(() => nuxt.close())
    let finish!: () => void
    const vue = {
      name: 'vite:vue',
      transform: {
        handler (this: { warn: (log: unknown) => void }, code: string, _id: string) {
          this.warn({ message: 'from a deleted file' })
          return new Promise((resolve) => { finish = () => resolve({ code }) })
        },
      },
    }
    const plugin = VueCompilerWarningsPlugin(nuxt, vue as any, sink)
    const watcher = new EventEmitter()
    ;(plugin.configureServer as (server: unknown) => void)({ watcher })

    const pending = vue.transform.handler.call({ warn: () => {}, environment: { name: 'client' } }, '<template />', file)
    await rm(file)
    watcher.emit('unlink', file)
    finish()
    await pending

    await new Promise(resolve => setTimeout(resolve, 200))
    expect(sink.sets.flatMap(set => set.reports)).toEqual([])
  })

  it('drops the warnings of a deleted SFC', async () => {
    const file = join(tmpDir, 'Deleted.vue')
    await writeFile(file, '<template>\n  <p><p>nested</p></p>\n</template>\n')
    const { server, sets } = await startServer()

    await server.environments.client.transformRequest('/Deleted.vue')
    await vi.waitFor(() => expect(sets.at(-1)).toMatchObject({ reports: [{ message: NESTING }] }))

    await rm(file)
    server.watcher.emit('unlink', file)
    await vi.waitFor(() => expect(sets.at(-1)).toMatchObject({ reports: [] }))
  })
})
