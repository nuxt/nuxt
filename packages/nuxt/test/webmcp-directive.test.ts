// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeepAlive, createApp, defineComponent, effectScope, h, nextTick, reactive, ref, vModelText, vShow, withDirectives } from 'vue'

import type { AgentToolBinding } from '../src/webmcp/runtime/directive.ts'
import { createAgentToolDirective, createSubmitCapture } from '../src/webmcp/runtime/directive.ts'
import { createAgentToolRegistry } from '../src/webmcp/runtime/registry.ts'
import { highlight, submitterOf } from '../src/webmcp/runtime/dom.ts'
import { agentToolRegistryKey, defineAgentTool, useAgentActivity, useAgentTool } from '../src/webmcp/runtime/composables.ts'

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

  it('describes a form without a schema from its controls and labels, and from its current values when marked `values`', async () => {
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
    ]), [[directive, binding({ name: 'order', kind: 'form', values: true, fields })]]))
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

  it('leaves current values out of the schema of a form that is not marked `values`', async () => {
    const state = reactive({ email: 'daniel@example.com', plan: 'pro' })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const invoke = vi.fn()
    const { registry } = mount(directive => () => withDirectives(h('div', [
      h('input', { 'required': true, 'data-agent-field': 'state.email' }),
      h('input', { 'disabled': true, 'data-agent-field': 'state.plan' }),
    ]), [[directive, binding({ name: 'save', kind: 'form', invoke, fields: { email: field('email'), plan: field('plan') } })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema).toEqual({ type: 'object', properties: { email: { type: 'string' }, plan: { type: 'string' } }, required: [] })
    expect(await registry.call('save', { plan: 'pro' })).toMatchObject({ isError: true, content: [{ text: 'The form was not submitted. plan: this field cannot be changed' }] })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('leaves the values of passwords, payment cards and hidden fields out of the schema', async () => {
    const state = reactive({ email: 'daniel@example.com', password: 'hunter2', card: '4111111111111111', token: 'secret', pin: '0000' })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('input', { 'type': 'email', 'aria-label': 'Email', 'data-agent-field': 'state.email' }),
      h('input', { 'type': 'password', 'required': true, 'aria-label': 'Password', 'data-agent-field': 'state.password' }),
      h('input', { 'autocomplete': 'section-pay CC-Number', 'aria-label': 'Card number', 'data-agent-field': 'state.card' }),
      h('input', { 'type': 'hidden', 'data-agent-field': 'state.token' }),
      h('div', { 'autocomplete': 'one-time-code', 'data-agent-field': 'state.pin' }, [h('input', { 'aria-label': 'Code' })]),
    ]), [[directive, binding({ name: 'pay', kind: 'form', values: true, fields: { email: field('email'), password: field('password'), card: field('card'), token: field('token'), pin: field('pin') } })]]))
    await nextTick()

    const schema = registry.list()[0]!.inputSchema
    expect(schema.properties).toEqual({
      email: { type: 'string', format: 'email', description: 'Email', default: 'daniel@example.com' },
      password: { type: 'string', description: 'Password' },
      card: { type: 'string', description: 'Card number' },
      token: { type: 'string' },
      pin: { type: 'string', description: 'Code' },
    })
    expect(schema.required).toEqual([])
    expect(JSON.stringify(schema)).not.toMatch(/hunter2|4111|secret|0000/)
  })

  it('leaves the values of fields that are not rendered, and of secrets in components without a native control, out of the schema', async () => {
    const state = reactive({ name: 'Daniel', password: 'hunter2', pin: '0000', plan: 'pro', key: 'sk-live', shown: 's3cret', draft: 'private' })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('input', { 'data-agent-field': 'state.name' }),
      h('div', { 'type': 'password', 'data-agent-field': 'state.pin' }),
      h('div', { 'role': 'combobox', 'aria-label': 'Plan', 'data-agent-field': 'state.plan' }),
      h('div', { 'autocomplete': 'current-password', 'data-agent-field': 'state.key' }, [h('input', { autocomplete: 'off' })]),
      h('div', { 'type': 'password', 'data-agent-field': 'state.shown' }, [h('input', { type: 'text' })]),
      h('div', { hidden: '' }, [h('input', { 'data-agent-field': 'state.draft' })]),
    ]), [[directive, binding({ name: 'save', kind: 'form', values: true, fields: Object.fromEntries(Object.keys(state).map(key => [key, field(key as keyof typeof state)])) })]]))
    await nextTick()

    const schema = registry.list()[0]!.inputSchema
    expect(schema.properties).toEqual({
      name: { type: 'string', default: 'Daniel' },
      password: { type: 'string' },
      pin: { type: 'string' },
      plan: { type: 'string', description: 'Plan', default: 'pro' },
      key: { type: 'string' },
      shown: { type: 'string' },
      draft: { type: 'string' },
    })
    expect(JSON.stringify(schema)).not.toMatch(/hunter2|0000|sk-live|s3cret|private/)
  })

  it('leaves the values of `writeOnly` properties out of the schema', async () => {
    const state = reactive({ name: 'Daniel', token: 'existing-private-token', billing: { card: 'existing-private-card' } })
    const field = (key: 'name' | 'token') => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const card = { source: 'state.billing.card', get: () => state.billing.card, set: (value: unknown) => { state.billing.card = value as string } }
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => ({ value }),
        jsonSchema: { input: () => ({
          type: 'object',
          properties: {
            name: { type: 'string' },
            token: { type: 'string', writeOnly: true },
            billing: { type: 'object', writeOnly: true, properties: { card: { type: 'string' } } },
          },
          required: ['name', 'token'],
        }) },
      },
    }
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('input', { 'data-agent-field': 'state.name' }),
      h('input', { 'data-agent-field': 'state.token' }),
      h('input', { 'data-agent-field': 'state.billing.card' }),
    ]), [[directive, binding({ name: 'save', kind: 'form', confirm: true, values: true, schema: () => schema, fields: { 'name': field('name'), 'token': field('token'), 'billing.card': card } })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', default: 'Daniel' },
        token: { type: 'string', writeOnly: true },
        billing: { type: 'object', writeOnly: true, properties: { card: { type: 'string' } } },
      },
      required: [],
    })
  })

  it('keeps a field the user cannot see required while the form needs a value for it', async () => {
    const state = reactive({ email: '', coupon: '' })
    const sent = vi.fn()
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => (value as typeof state).coupon ? { value } : { issues: [{ message: 'Required', path: ['coupon'] }] },
        jsonSchema: { input: () => ({ type: 'object', properties: { email: { type: 'string' }, coupon: { type: 'string' } }, required: ['email', 'coupon'] }) },
      },
    }
    const { registry } = mount((directive, submits) => () => h('div', [
      withDirectives(h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault()
          submits.capture('order', sent)
        },
      }, [
        h('input', { 'data-agent-field': 'state.email' }),
        withDirectives(h('input', { 'data-agent-field': 'state.coupon' }), [[vShow, false]]),
      ]), [[directive, binding({ name: 'order', kind: 'form', schema: () => schema, fields: { email: field('email'), coupon: field('coupon') } })]]),
      withDirectives(h('form', [
        h('input', { 'data-agent-field': 'state.email' }),
        withDirectives(h('input', { 'required': true, 'data-agent-field': 'state.coupon' }), [[vShow, false]]),
      ]), [[directive, binding({ name: 'redeem', kind: 'form', fields: { email: field('email'), coupon: field('coupon') } })]]),
    ]))
    await nextTick()

    expect(registry.list().map(tool => tool.inputSchema.required)).toEqual([['email', 'coupon'], ['coupon']])
    expect(await registry.call('order', { email: 'daniel@example.com' })).toEqual({ isError: true, content: [{ type: 'text', text: expect.stringContaining('coupon') }] })
    expect(sent).not.toHaveBeenCalled()

    state.coupon = 'SAVE10'
    expect(await registry.call('order', { email: 'daniel@example.com' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalled()
  })

  it('registers and submits a form with a field whose model cannot be read until it is rendered', async () => {
    const state = reactive<{ email: string, extra?: { note: string } }>({ email: '' })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('send', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.email' }),
      state.extra ? h('input', { 'data-agent-field': 'state.extra.note' }) : null,
    ]), [[directive, binding({
      name: 'send',
      kind: 'form',
      fields: {
        'email': { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } },
        'extra.note': { source: 'state.extra.note', get: () => state.extra!.note, set: (value) => { state.extra!.note = value as string } },
      },
    })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toEqual({ email: { type: 'string' }, extra: { type: 'object', properties: { note: {} } } })
    expect(await registry.call('send', { email: 'daniel@example.com' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalled()
    expect(state).toEqual({ email: 'daniel@example.com' })
  })

  it('describes multiple selects and checkbox groups as arrays of their options', async () => {
    const state = reactive({ sizes: [] as string[], toppings: [] as string[] })
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('select', { 'multiple': true, 'aria-label': 'Sizes', 'data-agent-field': 'state.sizes' }, [
        h('option', { value: 's' }, 'Small'),
        h('option', { value: 'l' }, 'Large'),
      ]),
      h('fieldset', [
        h('label', ['Ham ', h('input', { 'type': 'checkbox', 'value': 'ham', 'data-agent-field': 'state.toppings' })]),
        h('label', ['Olives ', h('input', { 'type': 'checkbox', 'value': 'olives', 'data-agent-field': 'state.toppings' })]),
      ]),
    ]), [[directive, binding({
      name: 'order',
      kind: 'form',
      fields: {
        sizes: { source: 'state.sizes', get: () => state.sizes, set: (value) => { state.sizes = value as string[] } },
        toppings: { source: 'state.toppings', get: () => state.toppings, set: (value) => { state.toppings = value as string[] } },
      },
    })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toMatchObject({
      sizes: { type: 'array', items: { type: 'string', oneOf: [{ const: 's', title: 'Small' }, { const: 'l', title: 'Large' }] } },
      toppings: { type: 'array', items: { type: 'string', oneOf: [{ const: 'ham', title: 'Ham' }, { const: 'olives', title: 'Olives' }] } },
    })
  })

  it('describes choices bound to numbers and booleans with those values', async () => {
    const state = reactive({ ids: [] as number[], days: [] as number[], size: null as number | null, answer: null as boolean | string | null })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { (state as Record<string, unknown>)[key] = value } })
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('select', { 'multiple': true, 'data-agent-field': 'state.ids' }, [h('option', { value: 1 }, 'One'), h('option', { value: 2 }, 'Two')]),
      h('label', ['Monday ', h('input', { 'type': 'checkbox', 'value': 1, 'data-agent-field': 'state.days' })]),
      h('select', { 'data-agent-field': 'state.size' }, [h('option', { value: '' }, 'Choose'), h('option', { value: 0 }, 'None'), h('option', { value: 10 }, 'Ten')]),
      h('label', ['Yes ', h('input', { 'type': 'radio', 'value': true, 'data-agent-field': 'state.answer' })]),
      h('label', ['Maybe ', h('input', { 'type': 'radio', 'value': 'maybe', 'data-agent-field': 'state.answer' })]),
    ]), [[directive, binding({ name: 'pick', kind: 'form', fields: { ids: field('ids'), days: field('days'), size: field('size'), answer: field('answer') } })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toMatchObject({
      ids: { type: 'array', items: { type: 'number', oneOf: [{ const: 1, title: 'One' }, { const: 2, title: 'Two' }] } },
      days: { type: 'array', items: { type: 'number', oneOf: [{ const: 1, title: 'Monday' }] } },
      size: { type: 'number', oneOf: [{ const: 0, title: 'None' }, { const: 10, title: 'Ten' }] },
      answer: { oneOf: [{ const: true, title: 'Yes' }, { const: 'maybe', title: 'Maybe' }] },
    })
    expect(registry.list()[0]!.inputSchema.properties).not.toHaveProperty('answer.type')
  })

  it('rejects input for unknown fields and converts values to the type of the field', async () => {
    const state = reactive({ quantity: 1, express: false })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('ship', sent)
      },
    }, [
      h('input', { 'type': 'number', 'data-agent-field': 'state.quantity' }),
      h('input', { 'type': 'checkbox', 'data-agent-field': 'state.express' }),
    ]), [[directive, binding({
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

  it('restores the fields it wrote when a later field cannot be written', async () => {
    const state = reactive({ plan: 'pro', name: 'Daniel', age: 30 })
    const sent = vi.fn()
    const setPlan = vi.fn(() => { throw new Error('plan is fixed') })
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('save', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.name' }),
      h('input', { 'data-agent-field': 'state.age' }),
    ]), [[directive, binding({
      name: 'save',
      kind: 'form',
      fields: {
        plan: { source: 'state.plan', get: () => state.plan, set: setPlan },
        name: { source: 'state.name', get: () => state.name, set: (value) => { state.name = value as string } },
        age: {
          source: 'state.age',
          get: () => state.age,
          set: (value) => {
            if (typeof value !== 'number' || value < 0) {
              throw new Error('age must be a positive number')
            }
            state.age = value
          },
        },
      },
    })]]))
    await nextTick()

    expect(await registry.call('save', { name: 'Sarah', age: -1 })).toEqual({ isError: true, content: [{ type: 'text', text: 'age must be a positive number' }] })
    expect(sent).not.toHaveBeenCalled()
    expect(setPlan).not.toHaveBeenCalled()
    expect(state).toEqual({ plan: 'pro', name: 'Daniel', age: 30 })
  })

  it('rejects input for unknown fields of a nested object', async () => {
    const state = reactive({ address: { city: 'London' } })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('ship', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.address.city' }),
    ]), [[directive, binding({
      name: 'ship',
      kind: 'form',
      fields: { 'address.city': { source: 'state.address.city', get: () => state.address.city, set: (value) => { state.address.city = value as string } } },
    })]]))
    await nextTick()

    expect(await registry.call('ship', { address: { county: 'Kent' } })).toEqual({ isError: true, content: [{ type: 'text', text: 'The form was not submitted. address.county: not a field of this form' }] })
    expect(await registry.call('ship', { address: 'Kent' })).toEqual({ isError: true, content: [{ type: 'text', text: 'The form was not submitted. address: not a field of this form' }] })
    expect(sent).not.toHaveBeenCalled()

    expect(await registry.call('ship', { address: { city: 'Canterbury' } })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()
    expect(state.address.city).toBe('Canterbury')
  })

  it('rejects input that selects a choice the form does not offer', async () => {
    const state = reactive({ plan: '', region: '', size: 'm', extras: ['gift'] })
    const sent = vi.fn()
    const fields = Object.fromEntries(Object.keys(state).map(key => [key, {
      source: `state.${key}`,
      get: () => state[key as keyof typeof state],
      set: (value: unknown) => { (state as Record<string, unknown>)[key] = value },
    }]))
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('order', sent)
      },
    }, [
      h('select', { 'data-agent-field': 'state.plan' }, [h('option', { value: 'free' }, 'Free'), h('option', { value: 'pro' }, 'Pro')]),
      h('select', { 'data-agent-field': 'state.region' }),
      ...['s', 'm'].map(value => h('input', { 'type': 'radio', 'name': 'size', value, 'data-agent-field': 'state.size' })),
      ...['gift', 'card'].map(value => h('input', { 'type': 'checkbox', value, 'data-agent-field': 'state.extras' })),
    ]), [[directive, binding({ name: 'order', kind: 'form', fields })]]))
    await nextTick()

    expect(await registry.call('order', { plan: 'enterprise', region: 'eu', size: 'xl', extras: ['gift', 'ribbon'] })).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'The form was not submitted. plan: "enterprise" is not one of the choices; region: "eu" is not one of the choices; size: "xl" is not one of the choices; extras: "ribbon" is not one of the choices' }],
    })
    expect(sent).not.toHaveBeenCalled()

    expect(await registry.call('order', { plan: 'pro', size: 's', extras: [] })).not.toHaveProperty('isError')
    expect(await registry.call('order', { plan: '' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledTimes(2)
    expect(state).toEqual({ plan: '', region: '', size: 's', extras: [] })
  })

  it('leaves the hidden options of a select out of the schema and rejects input that selects one', async () => {
    const style = document.createElement('style')
    style.textContent = '.gone { display: none }'
    document.head.append(style)
    cleanups.push(() => style.remove())
    const state = reactive({ plan: 'free' })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('order', sent)
      },
    }, [
      h('select', { 'data-agent-field': 'state.plan' }, [
        h('option', { value: 'free' }, 'Free'),
        h('option', { value: 'pro' }, 'Pro'),
        h('option', { value: 'legacy', hidden: '' }, 'Legacy'),
        withDirectives(h('option', { value: 'trial' }, 'Trial'), [[vShow, false]]),
        h('option', { value: 'staff', class: 'gone' }, 'Staff'),
        h('optgroup', { label: 'Retired', hidden: '' }, [h('option', { value: 'beta' }, 'Beta')]),
      ]),
    ]), [[directive, binding({
      name: 'order',
      kind: 'form',
      fields: { plan: { source: 'state.plan', get: () => state.plan, set: (value) => { state.plan = value as string } } },
    })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toEqual({
      plan: { type: 'string', oneOf: [{ const: 'free', title: 'Free' }, { const: 'pro', title: 'Pro' }] },
    })
    for (const plan of ['legacy', 'trial', 'staff', 'beta']) {
      expect(await registry.call('order', { plan })).toEqual({ isError: true, content: [{ type: 'text', text: `The form was not submitted. plan: "${plan}" is not one of the choices` }] })
    }
    expect(sent).not.toHaveBeenCalled()

    expect(await registry.call('order', { plan: 'pro' })).not.toHaveProperty('isError')
    expect(state.plan).toBe('pro')
  })

  it('describes a checkbox with `true-value` and `false-value` by the values it writes', async () => {
    const state = reactive({ newsletter: 'no', terms: false })
    const fields = Object.fromEntries(Object.keys(state).map(key => [key, {
      source: `state.${key}`,
      get: () => state[key as keyof typeof state],
      set: (value: unknown) => { (state as Record<string, unknown>)[key] = value },
    }]))
    const { registry } = mount(directive => () => withDirectives(h('form', [
      h('input', { 'type': 'checkbox', 'true-value': 'yes', 'false-value': 'no', 'data-agent-field': 'state.newsletter' }),
      h('input', { 'type': 'checkbox', 'data-agent-field': 'state.terms' }),
    ]), [[directive, binding({ name: 'join', kind: 'form', fields })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toEqual({
      newsletter: { oneOf: [{ const: 'yes', title: 'checked' }, { const: 'no', title: 'unchecked' }] },
      terms: { type: 'boolean' },
    })
  })

  it('restores a form that a field outside its input stops from submitting', async () => {
    const state = reactive({ email: 'daniel@example.com' })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('send', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.email' }),
      h('label', ['Order number ', h('input', { name: 'order', required: true })]),
    ]), [[directive, binding({
      name: 'send',
      kind: 'form',
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()

    const started = Date.now()
    expect(await registry.call('send', { email: 'sarah@example.com' })).toEqual({ isError: true, content: [{ type: 'text', text: expect.stringMatching(/^The form was not submitted\. Order number: \S/) }] })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(sent).not.toHaveBeenCalled()
    expect(state.email).toBe('daniel@example.com')
  })

  it('leaves the value of a field hidden with `v-show` out of the schema and rejects input for it until it is shown', async () => {
    const state = reactive({ email: 'daniel@example.com', coupon: 'STAFF50', note: 'internal', advanced: false })
    const sent = vi.fn()
    const fields = Object.fromEntries(['email', 'coupon', 'note'].map(key => [key, {
      source: `state.${key}`,
      get: () => state[key as keyof typeof state],
      set: (value: unknown) => { (state as Record<string, unknown>)[key] = value },
    }]))
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('order', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.email' }),
      withDirectives(h('fieldset', [h('input', { 'data-agent-field': 'state.coupon' })]), [[vShow, state.advanced]]),
      withDirectives(h('input', { 'data-agent-field': 'state.note' }), [[vShow, state.advanced]]),
    ]), [[directive, binding({ name: 'order', kind: 'form', values: true, fields })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toEqual({
      email: { type: 'string', default: 'daniel@example.com' },
      coupon: { type: 'string' },
      note: { type: 'string' },
    })
    expect(await registry.call('order', { coupon: 'FREE', note: 'public' })).toEqual({ isError: true, content: [{ type: 'text', text: 'The form was not submitted. coupon: this field is not on the page; note: this field is not on the page' }] })
    expect(sent).not.toHaveBeenCalled()

    state.advanced = true
    await nextTick()
    expect(await registry.call('order', { coupon: 'FREE', note: 'public' })).not.toHaveProperty('isError')
    expect(state).toMatchObject({ coupon: 'FREE', note: 'public' })
  })

  it('reads and fills in only the fields the browser reports as rendered', async () => {
    const style = document.createElement('style')
    style.textContent = '.gone { display: none } .faded { opacity: 0 } .invisible { visibility: hidden }'
    document.head.append(style)
    cleanups.push(() => style.remove())
    const state = reactive({ sheet: 'a', faded: 'b', invisible: 'c', code: 'd', gift: true, picker: 'e' })
    const sent = vi.fn()
    const fields = Object.fromEntries(Object.keys(state).map(key => [key, {
      source: `state.${key}`,
      get: () => state[key as keyof typeof state],
      set: (value: unknown) => { (state as Record<string, unknown>)[key] = value },
    }]))
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('order', sent)
      },
    }, [
      h('input', { 'class': 'gone', 'data-agent-field': 'state.sheet' }),
      h('div', { class: 'faded' }, [h('input', { 'data-agent-field': 'state.faded' })]),
      h('input', { 'class': 'invisible', 'data-agent-field': 'state.invisible' }),
      h('label', ['Code ', h('input', { 'class': 'gone', 'data-agent-field': 'state.code' })]),
      h('label', ['Gift ', h('input', { 'type': 'checkbox', 'class': 'gone', 'data-agent-field': 'state.gift' })]),
      h('div', { 'aria-label': 'Picker', 'data-agent-field': 'state.picker' }, [h('input', { class: 'faded' })]),
    ]), [[directive, binding({ name: 'order', kind: 'form', values: true, fields })]]))
    await nextTick()

    expect(registry.list()[0]!.inputSchema.properties).toEqual({
      sheet: { type: 'string' },
      faded: { type: 'string' },
      invisible: { type: 'string' },
      code: { type: 'string' },
      gift: { type: 'boolean', description: 'Gift', default: true },
      picker: { type: 'string', description: 'Picker', default: 'e' },
    })
    expect(await registry.call('order', { sheet: 'x', faded: 'x', invisible: 'x', code: 'x' })).toEqual({
      isError: true,
      content: [{ type: 'text', text: `The form was not submitted. ${['sheet', 'faded', 'invisible', 'code'].map(key => `${key}: this field is not on the page`).join('; ')}` }],
    })
    expect(sent).not.toHaveBeenCalled()

    expect(await registry.call('order', { gift: false, picker: 'f' })).not.toHaveProperty('isError')
    expect(state).toEqual({ sheet: 'a', faded: 'b', invisible: 'c', code: 'd', gift: false, picker: 'f' })
  })

  it('rejects input that changes a disabled, read-only or hidden field', async () => {
    const state = reactive({ email: 'daniel@example.com', plan: 'free', account: 'a1', note: '' })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('save', sent)
      },
    }, [
      h('input', { 'readonly': true, 'data-agent-field': 'state.email' }),
      h('select', { 'disabled': true, 'data-agent-field': 'state.plan' }, [h('option', { value: 'free' }), h('option', { value: 'pro' })]),
      h('input', { 'type': 'hidden', 'data-agent-field': 'state.account' }),
      h('input', { 'data-agent-field': 'state.note' }),
    ]), [[directive, binding({ name: 'save', kind: 'form', values: true, fields: { email: field('email'), plan: field('plan'), account: field('account'), note: field('note') } })]]))
    await nextTick()

    expect(await registry.call('save', { email: 'sarah@example.com', plan: 'pro', account: 'b2', note: 'Hi' })).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'The form was not submitted. email: this field cannot be changed; plan: this field cannot be changed; account: this field is not on the page' }],
    })
    expect(sent).not.toHaveBeenCalled()
    expect(state).toEqual({ email: 'daniel@example.com', plan: 'free', account: 'a1', note: '' })

    expect(await registry.call('save', { email: 'daniel@example.com', plan: 'free', note: 'Hi' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()
    expect(state.note).toBe('Hi')
  })

  it('rejects input for a field that is not rendered', async () => {
    const state = reactive({ name: 'Daniel', role: 'member' })
    const admin = ref(false)
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('save', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.name' }),
      admin.value ? h('input', { 'data-agent-field': 'state.role' }) : null,
    ]), [[directive, binding({ name: 'save', kind: 'form', fields: { name: field('name'), role: field('role') } })]]))
    await nextTick()

    for (const role of ['admin', 'member']) {
      expect(await registry.call('save', { name: 'Sarah', role })).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'The form was not submitted. role: this field is not on the page' }],
      })
    }
    expect(sent).not.toHaveBeenCalled()
    expect(state).toEqual({ name: 'Daniel', role: 'member' })

    admin.value = true
    await nextTick()
    expect(await registry.call('save', { role: 'admin' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()
    expect(state.role).toBe('admin')
  })

  it('rejects input that changes a component without a native control that is disabled, or a field inside an inert or hidden element', async () => {
    const state = reactive({ plan: 'free', size: 's', color: 'red', tier: 'basic', note: '', tag: '', open: 'a' })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('save', sent)
      },
    }, [
      h('div', { 'role': 'combobox', 'aria-disabled': 'true', 'data-agent-field': 'state.plan' }),
      h('div', { 'role': 'combobox', 'data-disabled': '', 'data-agent-field': 'state.size' }),
      h('div', { 'role': 'combobox', 'disabled': '', 'data-agent-field': 'state.color' }),
      h('div', { 'role': 'combobox', 'data-agent-locked': '', 'data-agent-field': 'state.tier' }),
      h('div', { inert: '' }, [h('input', { 'data-agent-field': 'state.note' })]),
      h('div', { hidden: '' }, [h('input', { 'data-agent-field': 'state.tag' })]),
      h('div', { 'role': 'combobox', 'data-agent-field': 'state.open' }),
    ]), [[directive, binding({ name: 'save', kind: 'form', values: true, fields: Object.fromEntries(Object.keys(state).map(key => [key, field(key as keyof typeof state)])) })]]))
    await nextTick()

    expect(await registry.call('save', { plan: 'pro', size: 'm', color: 'blue', tier: 'plus', note: 'Hi', tag: 'x', open: 'b' })).toEqual({
      isError: true,
      content: [{ type: 'text', text: `The form was not submitted. ${['plan', 'size', 'color', 'tier', 'note'].map(key => `${key}: this field cannot be changed`).join('; ')}; tag: this field is not on the page` }],
    })
    expect(sent).not.toHaveBeenCalled()
    expect(state).toEqual({ plan: 'free', size: 's', color: 'red', tier: 'basic', note: '', tag: '', open: 'a' })

    expect(await registry.call('save', { plan: 'free', open: 'b' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()
    expect(state.open).toBe('b')
  })

  it('rejects input that repeats the value of a locked field whose value is not published', async () => {
    const state = reactive({ password: 'hunter2', token: 'existing-private-token', name: 'Daniel' })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { state[key] = value as string } })
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => ({ value }),
        jsonSchema: { input: () => ({ type: 'object', properties: { password: { type: 'string' }, token: { type: 'string', writeOnly: true }, name: { type: 'string' } } }) },
      },
    }
    const invoke = vi.fn()
    const { registry } = mount(directive => () => withDirectives(h('div', [
      h('input', { 'type': 'password', 'disabled': true, 'data-agent-field': 'state.password' }),
      h('input', { 'disabled': true, 'data-agent-field': 'state.token' }),
      h('input', { 'disabled': true, 'data-agent-field': 'state.name' }),
    ]), [[directive, binding({ name: 'save', kind: 'form', values: true, invoke, schema: () => schema, fields: { password: field('password'), token: field('token'), name: field('name') } })]]))
    await nextTick()

    for (const input of [{ password: 'hunter2' }, { password: 'guess' }, { token: 'existing-private-token' }, { token: 'guess' }]) {
      expect(await registry.call('save', input)).toMatchObject({ isError: true, content: [{ text: `The form was not submitted. ${Object.keys(input)[0]}: this field cannot be changed` }] })
    }
    expect(invoke).not.toHaveBeenCalled()

    expect(await registry.call('save', { name: 'Daniel' })).not.toHaveProperty('isError')
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('rejects input that selects a disabled choice or changes a disabled checkbox of a group', async () => {
    const state = reactive({ plan: 'free', size: 's', extras: ['terms'] as string[] })
    const field = (key: keyof typeof state) => ({ source: `state.${key}`, get: () => state[key], set: (value: unknown) => { (state as Record<string, unknown>)[key] = value } })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('order', sent)
      },
    }, [
      h('input', { 'type': 'radio', 'value': 'free', 'data-agent-field': 'state.plan' }),
      h('input', { 'type': 'radio', 'value': 'pro', 'data-agent-field': 'state.plan' }),
      h('input', { 'type': 'radio', 'value': 'restricted', 'disabled': true, 'data-agent-field': 'state.plan' }),
      h('select', { 'data-agent-field': 'state.size' }, [h('option', { value: 's' }), h('option', { value: 'm' }), h('option', { value: 'xl', disabled: true })]),
      h('input', { 'type': 'checkbox', 'value': 'terms', 'disabled': true, 'data-agent-field': 'state.extras' }),
      h('input', { 'type': 'checkbox', 'value': 'news', 'data-agent-field': 'state.extras' }),
    ]), [[directive, binding({ name: 'order', kind: 'form', fields: { plan: field('plan'), size: field('size'), extras: field('extras') } })]]))
    await nextTick()

    expect(await registry.call('order', { plan: 'restricted', size: 'xl', extras: ['news'] })).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'The form was not submitted. plan: "restricted" is disabled; size: "xl" is disabled; extras: "terms" is disabled' }],
    })
    expect(sent).not.toHaveBeenCalled()
    expect(state).toEqual({ plan: 'free', size: 's', extras: ['terms'] })

    expect(await registry.call('order', { plan: 'pro', size: 'm', extras: ['terms', 'news'] })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()
    expect(state).toEqual({ plan: 'pro', size: 'm', extras: ['terms', 'news'] })
  })

  it('checks the fields of a form component that renders no form element', async () => {
    const state = reactive({ email: 'daniel@example.com' })
    const invoke = vi.fn()
    const { registry } = mount(directive => () => withDirectives(h('div', [
      h('input', { 'readonly': true, 'data-agent-field': 'state.email' }),
    ]), [[directive, binding({
      name: 'save',
      kind: 'form',
      invoke,
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()

    expect(await registry.call('save', { email: 'sarah@example.com' })).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('email: this field cannot be changed') }] })
    expect(invoke).not.toHaveBeenCalled()
    expect(state.email).toBe('daniel@example.com')
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
    }, [h('input', { 'data-agent-field': 'state.email' })]), [[directive, binding({
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

  it('rejects calls to a form while the submit handler of a stopped call is pending', async () => {
    const state = reactive({ email: '' })
    const sent: string[] = []
    let finish!: () => void
    const saving = new Promise<void>((resolve) => { finish = resolve })
    const submitted = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submitted()
        submits.capture('send', () => saving.then(() => {
          sent.push(state.email)
        }))
      },
    }, [h('input', { 'data-agent-field': 'state.email' })]), [[directive, binding({
      name: 'send',
      kind: 'form',
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()
    let stop = () => {}
    registry.onActivity((activities) => {
      stop = () => activities.forEach(activity => activity.stop())
    })

    const first = registry.call('send', { email: 'daniel@example.com' })
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledOnce())
    stop()
    expect(await first).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('stopped') }] })
    expect(await registry.call('send', { email: 'sarah@example.com' })).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('already running') }] })

    finish()
    await vi.waitFor(() => expect(sent).toEqual(['daniel@example.com']))
    expect(await registry.call('send', { email: 'sarah@example.com' })).not.toHaveProperty('isError')
    expect(sent).toEqual(['daniel@example.com', 'sarah@example.com'])
  })

  it('submits a form only while one of its submit buttons is enabled', async () => {
    const state = reactive({ email: '', locked: false })
    const sent = vi.fn()
    const { registry } = mount((directive, submits) => () => withDirectives(h('form', {
      onSubmit: (event: Event) => {
        event.preventDefault()
        submits.capture('send', sent)
      },
    }, [
      h('input', { 'data-agent-field': 'state.email' }),
      h('button', { disabled: true }, 'Save draft'),
      h('button', { disabled: state.locked || !state.email }, 'Send'),
    ]), [[directive, binding({
      name: 'send',
      kind: 'form',
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()

    expect(await registry.call('send', { email: 'daniel@example.com' })).not.toHaveProperty('isError')
    expect(sent).toHaveBeenCalledOnce()

    state.locked = true
    await nextTick()
    expect(await registry.call('send', { email: 'sarah@example.com' })).toEqual({ isError: true, content: [{ type: 'text', text: 'The form was not submitted. The submit button is disabled.' }] })
    expect(sent).toHaveBeenCalledOnce()
    expect(state.email).toBe('daniel@example.com')
  })

  it('leaves a form unchanged when the call is stopped while its schema validates', async () => {
    const state = reactive({ email: 'daniel@example.com' })
    let validated!: () => void
    const validating = new Promise<void>((resolve) => { validated = resolve })
    const schema = { '~standard': { version: 1, vendor: 'test', validate: (value: unknown) => validating.then(() => ({ value })) } }
    const set = vi.fn((value: unknown) => { state.email = value as string })
    const { registry } = mount(directive => () => withDirectives(h('form', [h('input', { 'data-agent-field': 'state.email' })]), [[directive, binding({
      name: 'send',
      kind: 'form',
      schema: () => schema,
      fields: { email: { source: 'state.email', get: () => state.email, set } },
    })]]))
    await nextTick()
    registry.onActivity(activities => activities.forEach(activity => activity.stop()))

    expect(await registry.call('send', { email: 'sarah@example.com' })).toMatchObject({ isError: true })
    validated()
    await new Promise(resolve => setTimeout(resolve))
    expect(set).not.toHaveBeenCalled()
    expect(state.email).toBe('daniel@example.com')
  })

  it('leaves a form unchanged and unsubmitted when it unmounts while its schema validates', async () => {
    const state = reactive({ email: 'daniel@example.com' })
    const shown = ref(true)
    const sent = vi.fn()
    let validated!: () => void
    const validating = new Promise<void>((resolve) => { validated = resolve })
    const schema = { '~standard': { version: 1, vendor: 'test', validate: (value: unknown) => validating.then(() => ({ value })) } }
    const { registry } = mount(directive => () => shown.value
      ? withDirectives(h('section', [h('input', { 'data-agent-field': 'state.email' })]), [[directive, binding({
          name: 'send',
          kind: 'form',
          invoke: sent,
          schema: () => schema,
          fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
        })]])
      : h('p'))
    await nextTick()

    const call = registry.call('send', { email: 'sarah@example.com' })
    shown.value = false
    await nextTick()
    validated()
    expect(await call).toEqual({ isError: true, content: [{ type: 'text', text: '"send" is not available on the current page.' }] })
    await new Promise(resolve => setTimeout(resolve))
    expect(state.email).toBe('daniel@example.com')
    expect(sent).not.toHaveBeenCalled()
  })

  it('restores a form when the call is stopped while it is being filled in', async () => {
    const state = reactive({ email: 'daniel@example.com' })
    const { registry } = mount(directive => () => withDirectives(h('form', [h('input', { 'data-agent-field': 'state.email' })]), [[directive, binding({
      name: 'send',
      kind: 'form',
      fields: { email: { source: 'state.email', get: () => state.email, set: (value) => { state.email = value as string } } },
    })]]))
    await nextTick()
    let stop = () => {}
    registry.onActivity((activities) => {
      stop = () => activities.forEach(activity => activity.stop())
    })

    const result = registry.call('send', { email: 'sarah@example.com' })
    expect(state.email).toBe('sarah@example.com')
    stop()
    expect(await result).toMatchObject({ isError: true })
    await nextTick()
    expect(state.email).toBe('daniel@example.com')
  })

  it('keeps waiting for a submit when an earlier wait for the same form times out', async () => {
    vi.useFakeTimers()
    cleanups.push(() => vi.useRealTimers())
    const submits = createSubmitCapture()
    const first = submits.wait('send', 100)
    first.catch(() => {})
    await vi.advanceTimersByTimeAsync(50)
    const second = submits.wait('send', 100)
    await vi.advanceTimersByTimeAsync(60)
    await expect(first).rejects.toThrow('The form did not submit.')
    submits.capture('send', () => 'sent')
    await expect(second).resolves.toBe('sent')
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

  it('gives items in nested loops different targets when their keys contain the separator', async () => {
    const picked = vi.fn()
    const items = [['docs', 'intro'], ['docs/guide', 'intro'], ['docs', 'guide/intro'], ['50%', 'off']]
    const { registry } = mount(directive => () => h('ul', items.map(keys => withDirectives(h('li', keys.join(' ')), [[directive, binding({ name: 'open', target: keys, invoke: () => picked(keys) })]]))))
    await nextTick()

    const targets = registry.targets('open').open!.map(item => item.target)
    expect(targets).toEqual(['docs/intro', 'docs%2Fguide/intro', 'docs/guide%2Fintro', '50%25/off'])
    for (const target of targets) {
      await registry.call('open', { target })
    }
    expect(picked.mock.calls.map(([keys]) => keys)).toEqual(items)
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

  it('submits a form with a submit button that belongs to it', () => {
    const container = document.createElement('div')
    container.innerHTML = '<form id="other"></form><form id="main"><span type="submit">Go</span><button form="other">Search</button><button type="button">Reset</button><button>Send</button></form>'
    document.body.append(container)
    cleanups.push(() => container.remove())
    // happy-dom does not associate a control with the form its `form` attribute names
    Object.defineProperty(container.querySelector('[form]'), 'form', { value: container.querySelector('#other') })
    expect(submitterOf(container.querySelector('#main')!)?.textContent).toBe('Send')
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

  it('reports and stops a call that started before `useAgentActivity` mounted', async () => {
    const shown = ref(false)
    let activity!: ReturnType<typeof useAgentActivity>
    const Status = defineComponent({
      setup () {
        activity = useAgentActivity()
        return () => h('div')
      },
    })
    const { registry } = mount(() => () => shown.value ? h(Status) : h('span'))
    registry.activate(defineAgentTool({ name: 'slow', description: 'Take a while.', execute: () => new Promise(() => {}) }))
    const result = registry.call('slow')

    shown.value = true
    await nextTick()
    expect(activity.current.value?.tool).toBe('slow')

    activity.stop()
    expect(await result).toMatchObject({ isError: true })
    expect(activity.activities.value).toEqual([])
  })

  it('keeps `useAgentActivity` subscribed for as long as the scope it was called in', async () => {
    const shown = ref(true)
    const scope = effectScope(true)
    let activity!: ReturnType<typeof useAgentActivity>
    const Status = defineComponent({
      setup () {
        activity = scope.run(() => useAgentActivity())!
        return () => h('div')
      },
    })
    const { registry } = mount(() => () => shown.value ? h(Status) : h('span'))
    registry.activate(defineAgentTool({ name: 'slow', description: 'Take a while.', execute: () => new Promise(() => {}) }))
    await nextTick()
    shown.value = false
    await nextTick()

    const first = registry.call('slow')
    expect(activity.current.value?.tool).toBe('slow')
    activity.stop()
    await first

    scope.stop()
    registry.call('slow')
    expect(activity.activities.value).toEqual([])
  })

  it('does not subscribe `useAgentActivity` when its scope stops before the component mounts', async () => {
    let activity!: ReturnType<typeof useAgentActivity>
    const Status = defineComponent({
      setup () {
        const scope = effectScope(true)
        activity = scope.run(() => useAgentActivity())!
        scope.stop()
        return () => h('div')
      },
    })
    const { registry } = mount(() => () => h(Status))
    registry.activate(defineAgentTool({ name: 'slow', description: 'Take a while.', execute: () => new Promise(() => {}) }))
    await nextTick()

    registry.call('slow')
    expect(activity.activities.value).toEqual([])
  })

  it('returns `useAgentActivity` activities that cannot be replaced', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let activity!: ReturnType<typeof useAgentActivity>
    mount(() => () => h(defineComponent({
      setup () {
        activity = useAgentActivity()
        return () => h('div')
      },
    })))
    await nextTick()
    // @ts-expect-error `activities` is read-only
    activity.activities.value = [{ id: 1, tool: 'fake', message: '', input: {}, stop: () => {} }]
    expect(activity.activities.value).toEqual([])
    warn.mockRestore()
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
