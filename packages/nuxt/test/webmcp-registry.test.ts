import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { AgentToolActivity, ModelContextLike, ModelContextTool } from '../src/webmcp/runtime/registry.ts'
import { BUDGETS, createAgentToolRegistry, lintTool } from '../src/webmcp/runtime/registry.ts'
import { describeNavigation } from '../src/webmcp/runtime/navigate.ts'
import { defineAgentTool } from '../src/webmcp/runtime/composables.ts'

function setup () {
  const registered = new Map<string, ModelContextTool>()
  const registerTool = vi.fn<ModelContextLike['registerTool']>((tool, { signal }) => {
    if (registered.has(tool.name)) {
      throw new Error(`${tool.name} is already registered`)
    }
    registered.set(tool.name, tool)
    signal.addEventListener('abort', () => registered.delete(tool.name))
  })
  const lint = vi.fn()
  const registry = createAgentToolRegistry({ modelContext: () => ({ registerTool }), schedule: flush => flush(), diagnostics: { lint } })
  return { registry, registered, registerTool, lint }
}

const greet = defineAgentTool({
  name: 'greet',
  description: 'Greet someone. Use when the user says hello.',
  input: z.object({ name: z.string() }),
  execute: ({ name }) => `Hello ${name}`,
})

describe('agent tool registry', () => {
  it('registers once per name and unregisters with the last activation', async () => {
    const { registry, registered, registerTool } = setup()
    const a = registry.activate(greet)
    const b = registry.activate(greet)
    expect(registerTool).toHaveBeenCalledTimes(1)
    a.dispose()
    expect(await registered.get('greet')!.execute({ name: 'Sarah' })).toEqual({ content: [{ type: 'text', text: 'Hello Sarah' }] })
    b.dispose()
    expect(registered.has('greet')).toBe(false)
  })

  it('derives the input schema from Standard JSON Schema and validates input', async () => {
    const { registry, registered } = setup()
    registry.activate(greet)
    expect(registered.get('greet')!.inputSchema).toMatchObject({ type: 'object', properties: { name: { type: 'string' } }, required: ['name'] })
    expect(await registry.call('greet', { name: 'Sarah' })).toEqual({ content: [{ type: 'text', text: 'Hello Sarah' }] })
    expect(await registry.call('greet', { name: 1 })).toMatchObject({ isError: true })
  })

  it('returns the error of an input schema that fails to validate', async () => {
    const { registry } = setup()
    const execute = vi.fn()
    registry.activate({
      name: 'lookup',
      description: 'Look something up. Use when asked.',
      input: { '~standard': { version: 1, vendor: 'test', validate: () => Promise.reject(new Error('The validator is offline')) } },
      execute,
    })
    expect(await registry.call('lookup', {})).toEqual({ isError: true, content: [{ type: 'text', text: 'The validator is offline' }] })
    expect(execute).not.toHaveBeenCalled()
  })

  it('adds a target argument and list_targets for targeted activations', async () => {
    const { registry, registered } = setup()
    const items = [{ id: 'a', name: 'Apple' }, { id: 'b', name: 'Banana' }]
    registry.activate(defineAgentTool({ name: 'eat', description: 'Eat a fruit.' }), {
      targets: () => items.map(item => ({ key: item.id, label: item.name, item })),
      execute: (_input, { target }) => `Ate ${target!.item!.name}`,
    })
    expect(registered.get('eat')!.inputSchema.required).toEqual(['target'])
    expect(registered.has('list_targets')).toBe(true)
    expect(registry.targets()).toEqual({ eat: [{ target: 'a', label: 'Apple' }, { target: 'b', label: 'Banana' }] })
    expect(await registry.call('eat', { target: 'b' })).toMatchObject({ content: [{ text: 'Ate Banana' }] })
    expect(await registry.call('eat', { target: 'c' })).toMatchObject({ isError: true })
  })

  it('keeps the name `list_targets` for the tool that lists targets', async () => {
    const registerFailed = vi.fn()
    const registry = createAgentToolRegistry({ schedule: flush => flush(), diagnostics: { registerFailed } })
    const execute = vi.fn()
    registry.activate({ name: 'list_targets', description: 'List the shipping targets. Use when asked.', execute })
    registry.activate({ name: 'remove', description: 'Remove an item. Use when asked.' }, { targets: () => [{ key: 'tea', label: 'Tea' }] })

    expect(registerFailed).toHaveBeenCalledWith('list_targets', expect.any(Error))
    expect(registry.list().map(tool => tool.name)).toEqual(['remove'])
    expect(await registry.call('list_targets')).toMatchObject({ isError: true })
    expect(execute).not.toHaveBeenCalled()
  })

  it('reports a tool with targets whose input has a `target` property', () => {
    const targetConflict = vi.fn()
    const registry = createAgentToolRegistry({ schedule: flush => flush(), diagnostics: { targetConflict } })
    const move = defineAgentTool({
      name: 'move',
      description: 'Move a file to a folder. Use when asked.',
      input: z.object({ target: z.string().describe('The folder to move the file to.') }),
      execute: () => {},
    })
    registry.activate(greet, { targets: () => [{ key: 'a', label: 'A' }] })
    registry.activate(move)
    expect(targetConflict).not.toHaveBeenCalled()

    registry.activate(move, { targets: () => [{ key: 'a.txt', label: 'a.txt' }] })
    registry.activate(move, { targets: () => [{ key: 'b.txt', label: 'b.txt' }] })
    expect(targetConflict.mock.calls).toEqual([['move']])
    expect(registry.list().find(tool => tool.name === 'move')!.inputSchema).toMatchObject({
      properties: { target: { description: expect.stringContaining('list_targets') } },
      required: ['target'],
    })
  })

  it('registers a tool again when an activation changes its input schema', () => {
    const { registry, registered, registerTool } = setup()
    const eat = defineAgentTool({ name: 'eat', description: 'Eat a fruit.' })
    registry.activate(eat)
    expect(registered.get('eat')!.inputSchema.required).toBeUndefined()

    const targeted = registry.activate(eat, { targets: () => [{ key: 'a', label: 'Apple' }] })
    expect(registered.get('eat')!.inputSchema.required).toEqual(['target'])
    registry.activate(eat, { targets: () => [{ key: 'b', label: 'Banana' }] })
    expect(registerTool.mock.calls.filter(([tool]) => tool.name === 'eat')).toHaveLength(2)

    targeted.dispose()
    expect(registered.get('eat')!.inputSchema.required).toEqual(['target'])
  })

  it('lists targets of tools named like object prototype members', async () => {
    const { registry, registered } = setup()
    registry.activate(defineAgentTool({ name: 'constructor', description: 'Build it.' }), { targets: () => [{ key: 'a', label: 'Apple' }] })
    expect(registry.targets()).toEqual({ constructor: [{ target: 'a', label: 'Apple' }] })
    const page = JSON.parse((await registered.get('list_targets')!.execute({})).content[0]!.text)
    expect(page.targets).toEqual({ constructor: [{ target: 'a', label: 'Apple' }] })
  })

  it('pages and searches list_targets', async () => {
    const { registry, registered } = setup()
    const items = Array.from({ length: 45 }, (_, i) => ({ key: String(i), label: i % 2 ? `Odd ${i}` : `Even ${i}` }))
    registry.activate(defineAgentTool({ name: 'pick', description: 'Pick one.' }), { targets: () => items, execute: () => 'ok' })
    const list = async (input: object) => JSON.parse((await registered.get('list_targets')!.execute(input)).content[0]!.text)

    expect(await list({})).toMatchObject({ page: 1, page_size: 20, total_count: 45, total_pages: 3 })
    expect((await list({ page: 3 })).targets.pick).toHaveLength(5)
    expect(await list({ query: 'odd 1' })).toMatchObject({ total_count: 9 })
  })

  it('keeps disabled tools registered and reports them as unavailable', async () => {
    const { registry, registered } = setup()
    let enabled = false
    registry.activate(greet, { enabled: () => enabled })
    expect(registered.has('greet')).toBe(true)
    expect(await registry.call('greet', { name: 'x' })).toMatchObject({ isError: true })
    enabled = true
    expect(await registry.call('greet', { name: 'x' })).toMatchObject({ content: [{ text: 'Hello x' }] })
  })

  it('stages tools with `confirm` instead of running them', async () => {
    const { registry } = setup()
    const execute = vi.fn(() => 'Cleared')
    registry.activate(defineAgentTool({ name: 'clear', description: 'Clear the cart.', confirm: true, execute }), { stage: () => 'Highlighted the button.' })

    const result = await registry.call('clear')
    expect(JSON.parse(result.content[0]!.text)).toEqual({ status: 'requires_user_action', message: 'Highlighted the button.' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('applies the definition of the activation a call selects when tools share a name', async () => {
    const duplicate = vi.fn()
    const registered = new Map<string, ModelContextTool>()
    const registry = createAgentToolRegistry({
      modelContext: () => ({ registerTool: (tool, { signal }) => { registered.set(tool.name, tool); signal.addEventListener('abort', () => registered.delete(tool.name)) } }),
      schedule: flush => flush(),
      diagnostics: { duplicate },
    })
    const archive = vi.fn()
    const destroy = vi.fn()
    const first = registry.activate(defineAgentTool({ name: 'remove', description: 'Archive a note.', annotations: { readOnlyHint: true } }), {
      targets: () => [{ key: 'note', label: 'Note' }],
      execute: archive,
    })
    registry.activate(defineAgentTool({ name: 'remove', description: 'Delete an account.', confirm: true, annotations: { consequentialHint: true }, input: z.object({ reason: z.string() }) }), {
      targets: () => [{ key: 'account', label: 'Account' }],
      stage: () => 'Ready to delete.',
      execute: destroy,
    })
    expect(duplicate).toHaveBeenCalledWith('remove')
    expect(registered.get('remove')!.annotations).toEqual({ consequentialHint: true })

    expect(await registry.call('remove', { target: 'account' })).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('reason') }] })
    expect(await registry.call('remove', { target: 'account', reason: 'Asked.' })).toMatchObject({ content: [{ text: expect.stringContaining('requires_user_action') }] })
    expect(destroy).not.toHaveBeenCalled()
    expect(await registry.call('remove', { target: 'note' })).not.toHaveProperty('isError')
    expect(archive).toHaveBeenCalledOnce()

    first.dispose()
    expect(registered.get('remove')!.description).toBe('Delete an account. This prepares the action on the page; the user completes it.')
    expect(await registry.call('remove', { target: 'account', reason: 'Asked.' })).toMatchObject({ content: [{ text: expect.stringContaining('requires_user_action') }] })
    expect(destroy).not.toHaveBeenCalled()
  })

  it('reports tools that share a name and description but differ in flags', () => {
    const duplicate = vi.fn()
    const registry = createAgentToolRegistry({ schedule: flush => flush(), diagnostics: { duplicate } })
    const description = 'Remove an item. Use when asked.'
    registry.activate(defineAgentTool({ name: 'remove', description }))
    registry.activate(defineAgentTool({ name: 'remove', description }))
    expect(duplicate).not.toHaveBeenCalled()
    registry.activate(defineAgentTool({ name: 'remove', description, confirm: true }))
    registry.activate(defineAgentTool({ name: 'remove', description, annotations: { consequentialHint: true } }))
    expect(duplicate).toHaveBeenCalledTimes(2)
  })

  it('only declares hints that are true', () => {
    const { registry } = setup()
    registry.activate(defineAgentTool({ name: 'look', description: 'Look.', annotations: { readOnlyHint: true, consequentialHint: false } }))
    expect(registry.list()[0]!.annotations).toEqual({ readOnlyHint: true })
  })

  it('reports calls in progress and stops them', async () => {
    const { registry } = setup()
    let aborted = false
    registry.activate(defineAgentTool({
      name: 'slow',
      description: 'Take a while.',
      execute: (_input, { signal }) => new Promise((resolve) => {
        signal.addEventListener('abort', () => {
          aborted = true
        })
        setTimeout(resolve, 1000, 'Done')
      }),
    }))
    let current: AgentToolActivity[] = []
    registry.onActivity((list) => {
      current = list
    })

    const result = registry.call('slow')
    await vi.waitFor(() => expect(current.map(a => a.tool)).toEqual(['slow']))
    current[0]!.stop()

    expect(await result).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('stopped') }] })
    expect(aborted).toBe(true)
    expect(current).toEqual([])
  })

  it('does not run a call stopped while it is being prepared', async () => {
    const { registry } = setup()
    let finishPreparing!: () => void
    const execute = vi.fn()
    registry.activate(defineAgentTool({ name: 'save', description: 'Save. Use when asked.', execute }), {
      prepare: () => new Promise<void>((resolve) => {
        finishPreparing = resolve
      }),
    })
    let current: AgentToolActivity[] = []
    registry.onActivity((list) => {
      current = list
    })

    const result = registry.call('save')
    await vi.waitFor(() => expect(current).toHaveLength(1))
    current[0]!.stop()
    expect(await result).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('stopped') }] })

    finishPreparing()
    await new Promise(resolve => setTimeout(resolve))
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not run a call whose tool is withdrawn while its input validates or it is being prepared', async () => {
    const { registry } = setup()
    const execute = vi.fn()
    let validated!: (result: { value: unknown }) => void
    const validating = registry.activate({
      name: 'lookup',
      description: 'Look something up. Use when asked.',
      input: { '~standard': { version: 1, vendor: 'test', validate: () => new Promise<{ value: unknown }>((resolve) => { validated = resolve }) } },
      execute,
    })
    const first = registry.call('lookup', {})
    validating.dispose()
    validated({ value: {} })
    expect(await first).toEqual({ isError: true, content: [{ type: 'text', text: '"lookup" is not available on the current page.' }] })

    let prepared!: () => void
    const signals: AbortSignal[] = []
    const preparing = registry.activate({ name: 'save', description: 'Save the draft. Use when asked.' }, {
      prepare: (_input, { signal }) => {
        signals.push(signal)
        return new Promise<void>((resolve) => { prepared = resolve })
      },
      execute,
    })
    const second = registry.call('save')
    preparing.dispose()
    expect(signals[0]!.aborted).toBe(true)
    expect(await second).toEqual({ isError: true, content: [{ type: 'text', text: '"save" is not available on the current page.' }] })
    prepared()
    await new Promise(resolve => setTimeout(resolve))
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not run a call whose tool becomes disabled while its input validates', async () => {
    const { registry } = setup()
    const execute = vi.fn()
    let enabled = true
    let validated!: (result: { value: unknown }) => void
    registry.activate({
      name: 'lookup',
      description: 'Look something up. Use when asked.',
      input: { '~standard': { version: 1, vendor: 'test', validate: () => new Promise<{ value: unknown }>((resolve) => { validated = resolve }) } },
      execute,
    }, { enabled: () => enabled })
    const call = registry.call('lookup', {})
    enabled = false
    validated({ value: {} })
    expect(await call).toEqual({ isError: true, content: [{ type: 'text', text: '"lookup" is currently disabled.' }] })
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns the result of a call that withdraws its own tool as it runs', async () => {
    const { registry } = setup()
    const tool = registry.activate({
      name: 'remove',
      description: 'Remove the item. Use when asked.',
      execute: async () => {
        tool.dispose()
        await Promise.resolve()
        return 'Removed'
      },
    })
    expect(await registry.call('remove')).toEqual({ content: [{ type: 'text', text: 'Removed' }] })
  })

  it('rejects a call that an activity listener makes to a tool that is starting', async () => {
    const { registry } = setup()
    const execute = vi.fn()
    registry.activate(defineAgentTool({ name: 'save', description: 'Save. Use when asked.', execute }), { prepare: () => {} })
    let nested: ReturnType<typeof registry.call> | undefined
    registry.onActivity((activities) => {
      if (activities.length) {
        nested ??= registry.call('save')
      }
    })

    expect(await registry.call('save')).not.toHaveProperty('isError')
    expect(await nested).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('already running') }] })
    expect(execute).toHaveBeenCalledOnce()
    expect(await registry.call('save')).not.toHaveProperty('isError')
  })

  it('releases a tool when an activity listener throws as its call starts', async () => {
    const { registry } = setup()
    registry.activate(defineAgentTool({ name: 'save', description: 'Save. Use when asked.', execute: () => {} }), { prepare: () => {} })
    const stopListening = registry.onActivity((activities) => {
      if (activities.length) {
        throw new Error('Listener failed.')
      }
    })

    expect(await registry.call('save')).toEqual({ isError: true, content: [{ type: 'text', text: 'Listener failed.' }] })
    stopListening()
    expect(await registry.call('save')).not.toHaveProperty('isError')
  })

  it('keeps a tool reserved for a call that starts as a failed call settles', async () => {
    const { registry } = setup()
    let fail!: (error: Error) => void
    let finish!: () => void
    const prepare = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    registry.activate(defineAgentTool({ name: 'save', description: 'Save. Use when asked.', execute: () => {} }), { prepare })

    const first = registry.call('save')
    fail(new Error('Could not prepare.'))
    let replacement: ReturnType<typeof registry.call> | undefined
    for (let tick = 0; tick < 20 && !replacement; tick++) {
      await Promise.resolve()
      const attempt = registry.call('save')
      if (prepare.mock.calls.length === 2) {
        replacement = attempt
      }
    }
    expect(await first).toEqual({ isError: true, content: [{ type: 'text', text: 'Could not prepare.' }] })

    expect(await registry.call('save')).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('already running') }] })
    finish()
    expect(await replacement).not.toHaveProperty('isError')
    expect(await registry.call('save')).not.toHaveProperty('isError')
  })

  it('does not run a call whose signal has already aborted', async () => {
    const { registry } = setup()
    const execute = vi.fn()
    registry.activate(defineAgentTool({ name: 'save', description: 'Save. Use when asked.', execute }))

    expect(await registry.call('save', {}, { signal: AbortSignal.abort() })).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('stopped') }] })
    expect(execute).not.toHaveBeenCalled()
  })

  it('stops listening to the signal of a call that has finished', async () => {
    const { registry } = setup()
    registry.activate(greet)
    const { signal } = new AbortController()
    const added = vi.spyOn(signal, 'addEventListener')
    const removed = vi.spyOn(signal, 'removeEventListener')
    await registry.call('greet', { name: 'Sarah' }, { signal })
    expect(added).toHaveBeenCalledOnce()
    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0]![1])
  })

  it('uses the newest definition when a tool is replaced while registrations are held', async () => {
    const { registry } = setup()
    const before = registry.activate(defineAgentTool({ name: 'search', description: 'Search posts. Use when asked.', execute: () => 'posts' }))
    registry.hold()
    before.dispose()
    registry.activate(defineAgentTool({ name: 'search', description: 'Search products. Use when asked.', execute: () => 'products' }))
    registry.release()
    expect(await registry.call('search')).toMatchObject({ content: [{ text: 'products' }] })
  })

  it('defers registration changes while held', () => {
    const { registry, registered, registerTool } = setup()
    const handle = registry.activate(greet)
    registry.hold()
    handle.dispose()
    expect(registered.has('greet')).toBe(true)
    const next = registry.activate(greet)
    registry.release()
    expect(registerTool).toHaveBeenCalledTimes(1)
    expect(registered.has('greet')).toBe(true)
    next.dispose()
    expect(registered.has('greet')).toBe(false)
  })

  it('reports the tools on the page in browsers without WebMCP', () => {
    const onChange = vi.fn()
    const registry = createAgentToolRegistry({ schedule: flush => flush(), onChange })
    const handle = registry.activate(greet)
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'greet' })])
    handle.dispose()
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('lints tools when they register', () => {
    const { registry, lint } = setup()
    registry.activate(defineAgentTool({ name: 'a'.repeat(31), description: 'Do something. Use when needed.' }))
    expect(lint).toHaveBeenCalledWith('a'.repeat(31), ['its name is longer than 30 characters'])
  })

  it('lists the pages that fit in the description budget, shallowest first', () => {
    expect(describeNavigation(['/contact', '/blog/[slug]', '/'])).toMatch(/Pages: \/, \/contact, \/blog\/\[slug\]\.$/)

    const pages = Array.from({ length: 200 }, (_, i) => `/section/page-${i}`)
    const description = describeNavigation([...pages, '/about'])
    expect(description.length).toBeLessThanOrEqual(BUDGETS.description)
    expect(description).toContain('Pages: /about, /section/page-0, ')
    const listed = description.split('Pages: ')[1]!.split(', ').length - 1
    expect(description).toMatch(new RegExp(`, and ${201 - listed} more\\.$`))
    expect(lintTool({ name: 'navigate', description, inputSchema: {}, annotations: {} })).toEqual([])
  })

  it('measures names, descriptions and parameters against the budgets', () => {
    expect(lintTool({
      name: 'search',
      description: '',
      inputSchema: { type: 'object', properties: { q: { type: 'string', description: 'x'.repeat(151) } } },
      annotations: {},
    })).toEqual([
      'it has no description',
      'parameter `q` has a description longer than 150 characters',
    ])
  })
})
