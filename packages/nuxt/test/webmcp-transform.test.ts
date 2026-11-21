import { describe, expect, it, vi } from 'vitest'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

import type { AgentToolFinding } from '../src/webmcp/compiler.ts'
import { createAgentToolTransform } from '../src/webmcp/compiler.ts'
import { reportAgentToolFinding } from '../src/webmcp/module.ts'

const FILE = '/app/pages/index.vue'

function compile (sfc: string, { ssr = false } = {}) {
  const findings: AgentToolFinding[] = []
  const transform = createAgentToolTransform({ report: finding => findings.push(finding) })
  const { descriptor } = parse(sfc, { filename: FILE })
  const script = compileScript(descriptor, { id: 'test' })
  const { code, errors } = compileTemplate({
    id: 'test',
    filename: FILE,
    source: descriptor.template!.content,
    ast: descriptor.template!.ast,
    ssr,
    ssrCssVars: [],
    compilerOptions: { nodeTransforms: [transform], bindingMetadata: script.bindings },
  })
  expect(errors).toEqual([])
  return { code, findings: findings.map(({ code, params }) => ({ code, ...params })) }
}

const script = `
<script setup lang="ts">
/**
 * Add a product to the cart. Use when the user wants to buy it.
 * @tool
 */
function addToCart (sku: string) {}

/**
 * Place the order. Use when the user is ready to pay.
 * @tool consequential
 */
function checkout () {}

/**
 * Subscribe to the newsletter. Use when the user asks for updates.
 * @tool
 * @input newsletterSchema
 */
function subscribe () {}
</script>`

describe('agent tool transform', () => {
  it('compiles action bindings to a directive with an invoker, a target and an enabled check', () => {
    const { code, findings } = compile(`${script}
<template>
  <ProductCard v-for="p in products" :key="p.sku" :disabled="!p.inStock" @add="addToCart(p.sku)" />
</template>`)
    expect(code).toContain('"data-agent-item": ""')
    expect(code).toContain('_resolveDirective("agent-tool")')
    expect(code).toContain('name: "add_to_cart", kind: "action", description: "Add a product to the cart. Use when the user wants to buy it."')
    expect(code).toContain('target: (p.sku)')
    expect(code).toContain('enabled: () => !(!p.inStock)')
    expect(code).toContain('invoke: ($event) => ($setup.addToCart(p.sku))')
    expect(findings).toEqual([
      { code: 'NUXT_B1026', fn: 'checkout' },
      { code: 'NUXT_B1026', fn: 'subscribe' },
    ])
  })

  it('compiles every tool bound on one element', () => {
    const { code, findings } = compile(`${script}
<template>
  <ProductCard v-for="p in products" :key="p.sku" @add="addToCart(p.sku)" @buy="checkout" />
</template>`)
    expect(code).toMatch(/\[\{ name: "add_to_cart".*\}, \{ name: "checkout".*invoke: \(\$event\) => \(\$setup\.checkout\(\$event\)\) \}\]/)
    expect(findings).toEqual([{ code: 'NUXT_B1026', fn: 'subscribe' }])
  })

  it('compiles handlers that end in a semicolon', () => {
    const { code } = compile(`${script}
<template>
  <button @click="addToCart('tea');">Add</button>
  <form @submit.prevent="subscribe($event);" />
</template>`)
    expect(code).toContain('invoke: ($event) => ($setup.addToCart(\'tea\'))')
    expect(code).toContain('_ctx.$agentTools.capture("subscribe", () => ($setup.subscribe($event)))')
  })

  it('compiles forms to field accessors and captures the submit handler result', () => {
    const { code } = compile(`${script}
<template>
  <form @submit.prevent="subscribe">
    <label>Email <input v-model="email" type="email"></label>
  </form>
  <AppForm :schema="checkoutSchema" :state="order" @submit="checkout">
    <AppInput v-model="order.email" />
    <AppInput v-model="order.address.city" />
  </AppForm>
</template>`)
    expect(code).toContain('_withModifiers($event => (_ctx.$agentTools.capture("subscribe", () => ($setup.subscribe($event)))), ["prevent"])')
    expect(code).toContain('"email": { source: "email", get: () => (_ctx.email), set: ($v) => { _ctx.email = $v } }')
    expect(code).toContain('schema: () => (_ctx.newsletterSchema)')
    expect(code).toContain('"data-agent-field": "order.email"')
    expect(code).toContain('"address.city": { source: "order.address.city", get: () => (_ctx.order.address.city), set: ($v) => { _ctx.order.address.city = $v } }')
    expect(code).toContain('root: () => (_ctx.order)')
    expect(code).toContain('schema: () => (_ctx.checkoutSchema)')
    expect(code).toContain('$event => (_ctx.$agentTools.capture("checkout", () => ($setup.checkout($event))))')
  })

  it('leaves fields that read a `v-for` or slot variable declared inside the form out of its input', () => {
    const { code } = compile(`${script}
<template>
  <form @submit.prevent="subscribe">
    <label v-for="row in rows" :key="row">Email <input v-model="email"></label>
    <label v-for="({ id, selected }, i) in topics" :key="id">Topic <input v-model="topics[i].selected" type="checkbox"></label>
    <Field v-slot="{ field }"><input v-model="field.value" aria-label="Name"></Field>
    <Field #default="{ error }"><input v-model="name" aria-label="Name"></Field>
    <Field v-slot="{ value: slotValue = fallback }"><input v-model="value" aria-label="Value"></Field>
    <label v-for="(city, index) in cities" :key="city">City <input v-model="profile['city']"><input v-model="profile[city]"><input v-model="profile.index"></label>
    <template v-for="item in outer"><label v-for="item in inner" :key="item">Item <input v-model="item.value"><input v-model="coupon"></label></template>
    <Field v-slot="{ error = entry, detail = error }"><label v-for="entry in entries" :key="entry">Entry <input v-model="entry.name"><input v-model="notes[list.findIndex(note => note.id === noteId)]"><input v-model="counts[(() => { return entry(); function entry () { return 0 } })()]"></label></Field>
  </form>
</template>`)
    const fields = [...code.matchAll(/"data-agent-field": "([^"]+)"/g)].map(match => match[1])
    expect(fields).toEqual(['email', 'name', 'value', 'profile[\'city\']', 'profile.index', 'coupon', 'notes[list.findIndex(note => note.id === noteId)]', 'counts[(() => { return entry(); function entry () { return 0 } })()]'])
    expect(code).toContain('fields: { "email": { source: "email", get: () => (_ctx.email), set: ($v) => { _ctx.email = $v } }, "name": {')
  })

  it('writes refs through `.value` when the template is inlined', () => {
    const transform = createAgentToolTransform()
    const { descriptor } = parse(`${script.replace('</script>', 'const email = ref(\'\')\n</script>')}
<template>
  <form @submit.prevent="subscribe"><label>Email <input v-model="email"></label></form>
</template>`, { filename: FILE })
    const { content } = compileScript(descriptor, { id: 'test', inlineTemplate: true, templateOptions: { compilerOptions: { nodeTransforms: [transform] } } })
    expect(content).toContain('"email": { source: "email", get: () => (_unref(email)), set: ($v) => { email.value = $v } }')
    expect(content).toContain('_ctx.$agentTools.capture("subscribe", () => (subscribe($event)))')
  })

  it('renders only the data attributes on the server', () => {
    const { code } = compile(`${script}
<template>
  <ul><li v-for="p in products" :key="p.sku"><button @click="addToCart(p.sku)">Add</button></li></ul>
  <form @submit.prevent="subscribe"><label>Email <input v-model="email"></label></form>
</template>`, { ssr: true })
    expect(code).toContain('data-agent-item')
    expect(code).toContain('data-agent-field')
    expect(code).not.toContain('agent-tool')
    expect(code).not.toContain('$agentTools')
  })

  it('reports bindings that cannot become tools', () => {
    const { findings } = compile(`
<script setup lang="ts">
/**
 * Add a product to the cart. Use when the user wants to buy it.
 * @tool autosubmit
 */
function addToCart (sku: string) {}

/**
 * Place the order. Use when the user is ready to pay.
 * @tool
 */
function checkout () {}
</script>
<template>
  <button v-for="(p, i) in products" :key="i" @click="addToCart(p.sku)">Add</button>
  <form @submit.prevent="() => checkout()" />
</template>`)
    expect(findings).toEqual([
      { code: 'NUXT_B1028', fn: 'addToCart' },
      { code: 'NUXT_B1027', handler: '() => checkout()' },
      { code: 'NUXT_B1025', fn: 'addToCart', flags: 'autosubmit' },
    ])
  })

  it('checks descriptions, flags and form labels against the tool design guidance', () => {
    const { findings } = compile(`
<script setup lang="ts">
/**
 * Calls the Pinia store to save the order with the email and shipping fields.
 * @tool confirm consequential
 */
function saveOrder () {}

const search = defineAgentTool({ name: 'search', description: 'Query the GraphQL endpoint.' })
</script>
<template>
  <form @submit.prevent="saveOrder">
    <input v-model="order.email">
    <label>Shipping <select v-model="order.shipping" /></label>
    <label for="gift">Gift</label><input id="gift" v-model="order.gift" type="checkbox">
  </form>
</template>`)
    expect(findings).toEqual([
      { code: 'NUXT_B1029', tool: 'search', problem: expect.stringContaining('mentions "GraphQL"') },
      { code: 'NUXT_B1029', tool: 'search', problem: expect.stringContaining('not when to use it') },
      { code: 'NUXT_B1029', tool: 'save_order', problem: expect.stringContaining('lists fields (email, shipping)') },
      { code: 'NUXT_B1030', source: 'order.email' },
      { code: 'NUXT_B1029', tool: 'save_order', problem: expect.stringContaining('mentions "Pinia"') },
      { code: 'NUXT_B1029', tool: 'save_order', problem: expect.stringContaining('not when to use it') },
      { code: 'NUXT_B1029', tool: 'save_order', problem: expect.stringContaining('drop `consequential`') },
    ])
  })

  it('reports each finding as the build diagnostic for its code', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const reported: Record<string, string> = {}
    const sources: string[] = []
    const transform = createAgentToolTransform({
      report: (finding, file, source) => {
        const diagnostic = reportAgentToolFinding(finding, file, source, '/app')
        reported[diagnostic.name] = diagnostic.message
        sources.push(...diagnostic.sources ?? [])
      },
    })
    const { descriptor } = parse(`<script setup lang="ts">
/**
 * Clear the cart.
 * @tool autosubmit
 */
function clearCart () {}

/**
 * Save the order. Use when the user is ready.
 * @tool
 */
function save () {}

/**
 * Pay for the order. Use when the user is ready.
 * @tool
 */
function pay () {}

/**
 * Print the order. Use when the user asks for a copy.
 * @tool
 */
function print () {}
</script>
<template>
  <form @submit.prevent="save"><input v-model="order.email"></form>
  <button v-for="(item, i) in items" :key="i" @click="clearCart">Clear</button>
  <button @click="() => pay()">Pay</button>
</template>`, { filename: FILE })
    compileTemplate({ id: 'test', filename: FILE, source: descriptor.template!.content, ast: descriptor.template!.ast, compilerOptions: { nodeTransforms: [transform] } })
    warn.mockRestore()

    expect(reported).toEqual({
      NUXT_B1025: expect.stringContaining('`clearCart` in `pages/index.vue` has unknown flags: autosubmit'),
      NUXT_B1026: expect.stringContaining('`print` in `pages/index.vue` is not bound to an element'),
      NUXT_B1027: expect.stringContaining('`() => pay()` in `pages/index.vue` calls a `@tool` function'),
      NUXT_B1028: expect.stringContaining('`clearCart` in `pages/index.vue` is inside a `v-for` keyed by its index'),
      NUXT_B1029: expect.stringContaining('`clear_cart` in `pages/index.vue` does not follow the tool design guidance'),
      NUXT_B1030: expect.stringContaining('`order.email` in `pages/index.vue` has no label'),
    })
    expect(sources).toContain('pages/index.vue:28:3')
  })

  it('reports each finding once until it is fixed', () => {
    const findings: string[] = []
    const transform = createAgentToolTransform({ report: finding => findings.push(finding.code) })
    const run = (sfc: string) => {
      const { descriptor } = parse(sfc, { filename: FILE })
      compileTemplate({ id: 'test', filename: FILE, source: descriptor.template!.content, ast: descriptor.template!.ast, compilerOptions: { nodeTransforms: [transform] } })
    }
    const unbound = `<script setup>\n/**\n * Clear the cart. Use when asked.\n * @tool\n */\nfunction clear () {}\n</script>\n<template><div /></template>`
    run(unbound)
    run(unbound)
    run(unbound.replace('<div />', '<button @click="clear">Clear</button>'))
    run(unbound)
    run(unbound.replace(' * @tool\n', ''))
    run(unbound)
    expect(findings).toEqual(['NUXT_B1026', 'NUXT_B1026', 'NUXT_B1026'])
  })
})
