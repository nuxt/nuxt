import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from 'nuxt/schema'

import { createScanProblems } from '../src/core/scan-problems.ts'
import { ERROR_CHANNEL_BROADCAST } from '../src/runtime/server/dev-error/index.ts'
import type { ErrorChannelMessage } from '../src/runtime/server/dev-error/index.ts'

const createFsAccessCheck = vi.hoisted(() => vi.fn())

vi.mock('../src/runtime/server/dev-error/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/runtime/server/dev-error/index.ts')>()
  createFsAccessCheck.mockImplementation(original.createFsAccessCheck)
  return { ...original, createFsAccessCheck }
})

let rootDir: string
let files: string[]
beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'nuxt-scan-problems-'))
  files = [join(rootDir, 'components/Foo.vue'), join(rootDir, 'components/foo/index.vue')]
  await mkdir(join(rootDir, 'components/foo'), { recursive: true })
  await Promise.all(files.map(file => writeFile(file, '<template><div /></template>\n')))
})
afterAll(() => rm(rootDir, { recursive: true, force: true }))

function createNuxt (dev: boolean) {
  const hooks = createHooks()
  return { options: { dev, rootDir, workspaceDir: rootDir, _layers: [] }, hook: hooks.hook, callHook: hooks.callHook } as unknown as Nuxt
}

const collision = () => ({ name: 'NUXT_B3011', code: 'NUXT_B3011', message: 'Two component files resolving to the same name `Foo`', fix: 'Rename one of the files.' })

type ProblemSetMessage = Extract<ErrorChannelMessage, { type: 'nuxt:dev:error:problems' }>

describe('scan problems', () => {
  const listeners: BroadcastChannel[] = []
  afterEach(() => {
    for (const listener of listeners.splice(0)) {
      listener.close()
    }
  })

  function listen () {
    const messages: ErrorChannelMessage[] = []
    const listener = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
    listener.onmessage = event => messages.push((event as MessageEvent<ErrorChannelMessage>).data)
    listeners.push(listener)
    return { messages, listener }
  }

  it('logs a problem only when a scan first finds it', () => {
    const problems = createScanProblems(createNuxt(false), 'nuxt:components', 'Components')
    const create = vi.fn(collision)
    const scan = (found: boolean) => {
      const scan = problems.scan()
      if (found) {
        scan.report('Foo', [], create)
        scan.report('Foo', [], create)
      }
      scan.done()
    }

    scan(true)
    scan(true)
    expect(create).toHaveBeenCalledTimes(1)

    scan(false)
    scan(true)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('publishes the problems of each scan as a problem set in development', async () => {
    const { messages } = listen()
    const nuxt = createNuxt(true)
    const problems = createScanProblems(nuxt, 'nuxt:components', 'Components')
    problems.scan().done()

    for (let i = 0; i < 2; i++) {
      const scan = problems.scan()
      scan.report('Foo', files, collision)
      scan.done()
      await vi.waitFor(() => expect(messages).toHaveLength(i + 1))
    }

    const [first, second] = messages as ProblemSetMessage[]
    expect(first).toMatchObject({ type: 'nuxt:dev:error:problems', source: 'nuxt:components', meta: { group: 'Nuxt', label: 'Components' } })
    expect(first!.reports).toMatchObject([{ kind: 'warning', name: 'NUXT_B3011', code: 'NUXT_B3011', hint: 'Rename one of the files.' }])
    expect(first!.reports[0]!.frames.map(frame => [frame.file, frame.line])).toStrictEqual(files.map(file => [file, undefined]))
    expect(second!.reports.map(report => report.id)).toStrictEqual(first!.reports.map(report => report.id))

    problems.scan().done()
    await vi.waitFor(() => expect(messages).toHaveLength(3))
    expect(messages[2]).toStrictEqual({ type: 'nuxt:dev:error:problems:clear', source: 'nuxt:components' })

    await nuxt.callHook('close', nuxt)
  })

  it('keeps the reports of the problems a rescan still finds', async () => {
    const { messages } = listen()
    const nuxt = createNuxt(true)
    const problems = createScanProblems(nuxt, 'nuxt:components', 'Components')

    const first = problems.scan()
    first.report('Foo', [files[0]!], collision)
    first.report('foo', [files[1]!], collision)
    first.done()
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    const reports = (messages[0] as ProblemSetMessage).reports
    expect(new Set(reports.map(report => report.id)).size).toBe(2)

    const second = problems.scan()
    second.report('foo', [files[1]!], collision)
    second.done()
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    expect((messages[1] as ProblemSetMessage).reports.map(report => report.id)).toStrictEqual([reports[1]!.id])

    await nuxt.callHook('close', nuxt)
  })

  it('reads the snippet of a problem again on each scan', async () => {
    const { messages } = listen()
    const nuxt = createNuxt(true)
    const problems = createScanProblems(nuxt, 'nuxt:imports', 'Imports')
    const file = join(rootDir, 'composables.ts')

    for (const value of [1, 2]) {
      await writeFile(file, `export const useFoo = () => ${value}\n`)
      const scan = problems.scan()
      scan.report('useFoo', [`${file}:1:14`], () => ({ message: 'Duplicated imports "useFoo"' }))
      scan.done()
      await vi.waitFor(() => expect(messages).toHaveLength(value))
    }

    const snippets = (messages as ProblemSetMessage[]).map(message => message.reports[0]!.frames[0]!.snippet?.lines[0])
    expect(snippets).toStrictEqual(['export const useFoo = () => 1', 'export const useFoo = () => 2'])

    await nuxt.callHook('close', nuxt)
  })

  it('moves a problem to its new location without logging it again', async () => {
    const { messages } = listen()
    const nuxt = createNuxt(true)
    const problems = createScanProblems(nuxt, 'nuxt:components', 'Components')
    const create = vi.fn(collision)

    for (const line of [1, 2]) {
      const scan = problems.scan()
      scan.report('Foo', [`${files[0]}:${line}:1`], create)
      scan.done()
      await vi.waitFor(() => expect(messages).toHaveLength(line))
    }

    expect(create).toHaveBeenCalledOnce()
    expect((messages as ProblemSetMessage[]).map(message => message.reports[0]!.frames[0]!.line)).toStrictEqual([1, 2])

    await nuxt.callHook('close', nuxt)
  })

  it('keeps the problems of a later scan when an earlier one finishes after it', () => {
    const problems = createScanProblems(createNuxt(false), 'nuxt:pages', 'Pages')
    const create = vi.fn(collision)

    const earlier = problems.scan()
    const later = problems.scan()
    later.report('Foo', [], create)
    later.done()
    earlier.done()

    const next = problems.scan()
    next.report('Foo', [], create)
    next.done()
    expect(create).toHaveBeenCalledOnce()
  })

  it('logs a new problem once when scans overlap', () => {
    const problems = createScanProblems(createNuxt(false), 'nuxt:imports', 'Imports')
    const create = vi.fn(collision)

    const earlier = problems.scan()
    const later = problems.scan()
    earlier.report('Foo', [], create)
    later.report('Foo', [], create)
    later.done()
    earlier.done()
    expect(create).toHaveBeenCalledOnce()
  })

  it('publishes a problem once its sources can be read after a failure', async () => {
    const { messages } = listen()
    const nuxt = createNuxt(true)
    const problems = createScanProblems(nuxt, 'nuxt:components', 'Components')
    createFsAccessCheck.mockRejectedValueOnce(new Error('ENOENT'))

    for (let i = 0; i < 2; i++) {
      const scan = problems.scan()
      scan.report('Foo', [files[0]!], collision)
      scan.done()
      await new Promise(resolve => setImmediate(resolve))
    }
    expect(createFsAccessCheck).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect((messages[0] as ProblemSetMessage).reports).toHaveLength(1)

    await nuxt.callHook('close', nuxt)
  })

  it('names a problem without a name after its source', async () => {
    const { messages } = listen()
    const nuxt = createNuxt(true)
    const scan = createScanProblems(nuxt, 'nuxt:imports', 'Imports').scan()
    scan.report('useFoo', [files[0]!], () => ({ message: 'Duplicated imports "useFoo"' }))
    scan.done()

    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect((messages[0] as ProblemSetMessage).reports).toMatchObject([{ name: 'Imports', message: 'Duplicated imports "useFoo"', frames: [{ file: files[0] }] }])

    await nuxt.callHook('close', nuxt)
  })

  it('republishes its problem sets when a channel opens, and retires them on close', async () => {
    const { messages, listener } = listen()
    const nuxt = createNuxt(true)
    const problems = createScanProblems(nuxt, 'nuxt:imports', 'Imports')

    const scan = problems.scan()
    scan.report('useFoo', [], () => ({ message: 'Duplicated imports "useFoo"' }))
    scan.done()
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    listener.postMessage({ type: 'nuxt:dev:error:sync' } satisfies ErrorChannelMessage)
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    expect(messages[1]).toStrictEqual(messages[0])

    await nuxt.callHook('close', nuxt)
    await vi.waitFor(() => expect(messages).toHaveLength(3))
    expect(messages[2]).toStrictEqual({ type: 'nuxt:dev:error:problems:clear', source: 'nuxt:imports' })
  })
})
