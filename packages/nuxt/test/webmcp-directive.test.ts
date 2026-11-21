// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeepAlive, createApp, defineComponent, h, nextTick, reactive, ref, vModelText, withDirectives } from 'vue'

import type { AgentToolBinding } from '../src/webmcp/runtime/directive.ts'
import { createAgentToolDirective, createSubmitCapture } from '../src/webmcp/runtime/directive.ts'
import { createAgentToolRegistry } from '../src/webmcp/runtime/registry.ts'
import { highlight } from '../src/webmcp/runtime/dom.ts'
import { agentToolRegistryKey, defineAgentTool, useAgentTool } from '../src/webmcp/runtime/composables.ts'

const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()))

function mount (render: (directive: ReturnType<typeof createAgentToolDirective>, submits: ReturnType<typeof createSubmitCapture>) => () => ReturnType<typeof h>) {
  const registry = createAgentToolRegistry({ highlight })
  const submits = createSubmitCapture()
  const directive = createAgentToolDirective(registry, submits)
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(defineComponent({ setup: () => render(directive, submits) }))
  app.provide(agentToolRegistryKey, registry)
  app.mount(container)
  cleanups.push(() => {
    app.unmount()
    container.remove()
  })
  return { registry, container, app }
}

function binding (overrides: Partial<AgentToolBinding>): AgentToolBinding {
  return { name: 'tool', kind: 'action', description: 'Do it. Use when asked.', readonly: false, consequential: false, confirm: false, invoke: () => {}, ...overrides }
}

describe('agent tool directive', () => {
  it('leaves a form without a schema unchanged when native validation rejects the input', async () => {
    const state = reactive({ email: 'daniel@example.com' })
    const sent = vi.fn()
    const { registry, container } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('send', sent)
      },
    }, [
      withDirectives(h('input', { 'type': 'email', 'data-agent-field': 'state.email', 'onUpdate:modelValue': (value: string) => { state.email = value } }), [[vModelText, state.email]]),
    ]), [[directive, binding({
      name: 'send',
      kind: 'form',
      invoke: sent,
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()

    expect(await registry.call('send', { email: 'not an email' })).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('email:') }] })
    expect(sent).not.toHaveBeenCalled()
    expect(state.email).toBe('daniel@example.com')
    await nextTick()
    expect(container.querySelector('input')!.value).toBe('daniel@example.com')
  })

  it('describes a form without a schema from its controls, labels and current values', async () => {
    const state = reactive({ email: '', quantity: 2, gift: false, plan: 'pro', note: '', code: '' })
    const fields = Object.fromEntries(Object.keys(state).map(key => [key, {
      source: `state.${key}`,
      get: () => state[key as keyof typeof state],
      set: (value: unknown) => { (state as Record<string, unknown>)[key] = value },
    }]))
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('label', ['Email ', h('input', { 'type': 'email', 'required': true, 'data-agent-field': 'state.email' })]),
      h('label', ['Quantity ', h('input', { 'type': 'number', 'min': '1', 'max': '10', 'data-agent-field': 'state.quantity' })]),
      h('label', ['Gift ', h('input', { 'type': 'checkbox', 'data-agent-field': 'state.gift' })]),
      h('label', ['Plan ', h('select', { 'data-agent-field': 'state.plan' }, [
        h('option', { value: 'free' }, 'Free'),
        h('option', { value: 'pro' }, 'Pro'),
      ])]),
      h('span', { id: 'note-label' }, 'Note for the courier'),
      h('textarea', { 'aria-labelledby': 'note-label', 'data-agent-field': 'state.note' }),
      h('label', ['Code ', h('input', { 'toolparamdescription': 'A discount code, if the user has one', 'data-agent-field': 'state.code' })]),
    ]), [[directive, binding({ name: 'order', kind: 'form', fields })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema).toEqual({
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', description: 'Email' },
        quantity: { type: 'number', minimum: 1, maximum: 10, description: 'Quantity', default: 2 },
        gift: { type: 'boolean', description: 'Gift', default: false },
        plan: { type: 'string', oneOf: [{ const: 'free', title: 'Free' }, { const: 'pro', title: 'Pro' }], description: 'Plan', default: 'pro' },
        note: { type: 'string', description: 'Note for the courier' },
        code: { type: 'string', description: 'A discount code, if the user has one' },
      },
      required: ['email'],
    })
  })

  it('rejects input for unknown fields and converts values to the type of the field', async () => {
    const state = reactive({ quantity: 1, express: false })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('ship', sent)
      },
    }), [[directive, binding({
      name: 'ship',
      kind: 'form',
      fields: {
        quantity: { source: 'state.quantity', get: () => state.quantity, set: (value) => { state.quantity = value as number } },
        express: { source: 'state.express', get: () => state.express, set: (value) => { state.express = value as boolean } },
      },
    })]]))
    await nextTick()

    expect(await registry.call('ship', { coupon: 'FREE' })).toEqual({ isError: true, content: [{ type: 'text', text: 'The form was not submitted. coupon: not a field of this form' }] })
    expect(sent).not.toHaveBeenCalled()

    expect(await registry.call('ship', { quantity: '4', express: 'true' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()
    expect(state).toEqual({ quantity: 4, express: true })
  })

  it('rejects a call to a form that another call is filling in', async () => {
    const state = reactive({ email: '' })
    const sent: string[] = []
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('send', () => {
          sent.push(state.email)
        })
      },
    }), [[directive, binding({
      name: 'send',
      kind: 'form',
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()

    const [first, second] = await Promise.all([
      registry.call('send', { email: 'daniel@example.com' }),
      registry.call('send', { email: 'sarah@example.com' }),
    ])
    expect(first).not.toHaveProperty('isError')
    expect(second).toEqual({ isError: true, content: [{ type: 'text', text: '"send" is already running. Wait for it to finish before calling it again.' }] })
    expect(sent).toEqual(['daniel@example.com'])

    expect(await registry.call('send', { email: 'sarah@example.com' })).not.toHaveProperty('isError')
    expect(sent).toEqual(['daniel@example.com', 'sarah@example.com'])
  })

  it('returns the error of a submit handler that throws', async () => {
    const { registry, app } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('send', () => {
          throw new Error('The shop is closed.')
        })
      },
    }), [[directive, binding({ name: 'send', kind: 'form', fields: {} })]]))
    const errorHandler = vi.fn()
    app.config.errorHandler = errorHandler
    await nextTick()

    expect(await registry.call('send')).toEqual({ isError: true, content: [{ type: 'text', text: 'The shop is closed.' }] })
    expect(errorHandler).toHaveBeenCalledOnce()
  })

  it('moves focus only for actions handed to the user', async () => {
    const { registry, container } = mount(directive => () => h('div', [
      h('input'),
      withDirectives(h('button', { id: 'add' }, 'Add'), [[directive, binding({ name: 'add' })]]),
      withDirectives(h('button', { id: 'clear' }, 'Clear'), [[directive, binding({ name: 'clear', confirm: true })]]),
    ]))
    await nextTick()
    const input = container.querySelector('input')!
    input.focus()

    await registry.call('add')
    expect(container.querySelector('#add')!.hasAttribute('data-agent-active')).toBe(true)
    expect(document.activeElement).toBe(input)

    await registry.call('clear')
    expect(document.activeElement).toBe(container.querySelector('#clear'))
  })

  it('registers every binding of an element and keeps each one current', async () => {
    const calls: string[] = []
    const suffix = ref('1')
    const { registry, app } = mount(directive => () => withDirectives(h('button', suffix.value), [[directive, [
      binding({ name: 'add', invoke: () => { calls.push(`add${suffix.value}`) } }),
      binding({ name: 'remove', invoke: () => { calls.push(`remove${suffix.value}`) } }),
    ]]]))
    await nextTick()
    expect(registry.list().map(tool => tool.name)).toEqual(['add', 'remove'])

    suffix.value = '2'
    await nextTick()
    await registry.call('add')
    await registry.call('remove')
    expect(calls).toEqual(['add2', 'remove2'])

    app.unmount()
    expect(registry.list()).toEqual([])
  })

  it('focuses the submit button of a form handed to the user', async () => {
    const { registry, container } = mount(directive => () => withDirectives(h('form', [
      h('button', { type: 'submit' }, 'Pay'),
    ]), [[directive, binding({ name: 'checkout', kind: 'form', confirm: true, fields: {} })]]))
    await nextTick()

    await registry.call('checkout')
    expect(document.activeElement).toBe(container.querySelector('button'))
  })

  it('offers a `useAgentTool` tool while it has targets, with their keys and labels', async () => {
    const items = ref<{ sku: string, title: string }[]>([])
    const enabled = ref(false)
    const { registry } = mount(() => {
      useAgentTool(defineAgentTool({ name: 'buy', description: 'Buy an item. Use when asked.' }), {
        enabled,
        targets: items,
        key: item => item.sku,
        label: item => item.title,
        execute: (_input, { target }) => `Bought ${target!.item.title}`,
      })
      return () => h('div')
    })
    await nextTick()
    expect(registry.list()).toEqual([])

    items.value = [{ sku: 'tea', title: 'Green tea' }]
    await nextTick()
    expect(registry.targets()).toEqual({ buy: [{ target: 'tea', label: 'Green tea', disabled: true }] })
    expect(await registry.call('buy', { target: 'tea' })).toMatchObject({ isError: true })

    enabled.value = true
    expect(await registry.call('buy', { target: 'tea' })).toEqual({ content: [{ type: 'text', text: 'Bought Green tea' }] })

    items.value = []
    await nextTick()
    expect(registry.list()).toEqual([])
  })

  it('withdraws a `useAgentTool` tool while its component is kept alive but inactive', async () => {
    const shown = ref(true)
    const Search = defineComponent({
      setup () {
        useAgentTool(defineAgentTool({ name: 'search', description: 'Search. Use when asked.' }))
        return () => h('div')
      },
    })
    const { registry } = mount(() => () => h(KeepAlive, () => shown.value ? h(Search) : h('span')))
    await nextTick()
    expect(registry.list().map(tool => tool.name)).toEqual(['search'])

    shown.value = false
    await nextTick()
    expect(registry.list()).toEqual([])

    shown.value = true
    await nextTick()
    expect(registry.list().map(tool => tool.name)).toEqual(['search'])
  })

  it('stops offering actions while their element is detached', async () => {
    const { registry, container } = mount(directive => () => h('ul', [
      withDirectives(h('li', { 'data-agent-item': '' }, ['Tea']), [[directive, binding({ name: 'add', target: 'tea' })]]),
    ]))
    await nextTick()
    expect(registry.targets()).toEqual({ add: [{ target: 'tea', label: 'Tea' }] })

    container.querySelector('ul')!.remove()
    expect(registry.targets()).toEqual({})
    expect(await registry.call('add', { target: 'tea' })).toMatchObject({ isError: true })
  })
})
