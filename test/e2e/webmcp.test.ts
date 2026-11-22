import type { Page } from '@playwright/test'
import { expect, fixtureDir, test } from './test-utils'

interface RegisteredTool {
  name: string
  description: string
  inputSchema: Record<string, any>
  annotations: Record<string, boolean>
}

declare global {
  interface Window {
    __tools: Map<string, RegisteredTool & { execute: (input: unknown) => Promise<{ content: { text: string }[], isError?: boolean }> }>
  }
}

test.use({
  nuxt: {
    rootDir: fixtureDir('webmcp'),
  },
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__tools = new Map()
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool (tool: any, { signal }: { signal: AbortSignal }) {
          window.__tools.set(tool.name, tool)
          signal.addEventListener('abort', () => {
            if (window.__tools.get(tool.name) === tool) {
              window.__tools.delete(tool.name)
            }
          })
        },
      },
    })
  })
})

function tools (page: Page) {
  return page.evaluate(() => [...window.__tools.values()].map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })))
}

async function call (page: Page, name: string, input: unknown = {}) {
  const result = await page.evaluate(([name, input]) => window.__tools.get(name as string)!.execute(input), [name, input] as const)
  return { text: result.content.map(c => c.text).join(''), isError: !!result.isError }
}

async function names (page: Page) {
  return (await tools(page)).map(tool => tool.name).sort()
}

test('registers template bindings, explicit tools and navigation', async ({ page, goto }) => {
  await goto('/')
  await expect.poll(() => names(page)).toEqual(['add_to_cart', 'clear_cart', 'list_targets', 'navigate', 'search_products'])

  const registered = Object.fromEntries((await tools(page)).map(tool => [tool.name, tool]))
  expect(registered.add_to_cart).toMatchObject({
    description: 'Add one of a product to the cart. Use when the user wants to buy something.',
    inputSchema: { required: ['target'] },
    annotations: {},
  })
  expect(registered.search_products!.annotations).toEqual({ readOnlyHint: true })
  expect(registered.navigate!.description).toContain('Pages: /, /contact')

  expect(JSON.parse((await call(page, 'list_targets', { tool: 'add_to_cart' })).text)).toEqual({
    targets: {
      add_to_cart: [
        { target: 'tea', label: 'Green tea' },
        { target: 'coffee', label: 'Coffee beans' },
        { target: 'cocoa', label: 'Cocoa', disabled: true },
      ],
    },
    page: 1,
    page_size: 20,
    total_count: 3,
    total_pages: 1,
  })
  expect(await call(page, 'search_products', { query: 'tea' })).toEqual({ text: '["tea"]', isError: false })
  await expect(page).toHaveNoErrorsOrWarnings()
})

test('runs actions on the item the agent picks', async ({ page, goto }) => {
  await goto('/')
  await expect.poll(() => names(page)).toContain('add_to_cart')

  expect(await call(page, 'add_to_cart', { target: 'coffee' })).toEqual({ text: 'Added coffee. The cart has 1 items.', isError: false })
  await expect(page.getByTestId('cart')).toHaveText('coffee')

  expect(await call(page, 'add_to_cart', { target: 'cocoa' })).toMatchObject({ isError: true, text: expect.stringContaining('disabled') })
  expect(await call(page, 'add_to_cart', { target: 'milk' })).toMatchObject({ isError: true, text: expect.stringContaining('list_targets') })
  await expect(page.getByTestId('cart')).toHaveText('coffee')
})

test('hands `confirm` tools over to the user', async ({ page, goto }) => {
  await goto('/')
  await expect.poll(() => names(page)).toContain('clear_cart')
  await call(page, 'add_to_cart', { target: 'tea' })

  expect(JSON.parse((await call(page, 'clear_cart')).text)).toEqual({ status: 'requires_user_action', message: 'Highlighted "Clear cart". The user needs to click it.' })
  await expect(page.getByTestId('cart')).toHaveText('tea')
  await expect(page.getByTestId('clear')).toHaveAttribute('data-agent-active', '')
})

test('fills and submits forms through their `v-model` bindings', async ({ page, goto }) => {
  await goto('/contact')
  await expect.poll(() => names(page)).toEqual(['navigate', 'send_message'])

  const [sendMessage] = (await tools(page)).filter(tool => tool.name === 'send_message')
  expect(sendMessage!.inputSchema).toMatchObject({
    properties: {
      email: { type: 'string', format: 'email', description: 'Email' },
      topic: { enum: ['order', 'other'], description: 'Topic' },
      message: { type: 'string', minLength: 5, description: 'Message' },
    },
    required: ['email', 'message'],
  })
  expect(JSON.stringify(sendMessage!.inputSchema)).not.toContain('default')

  expect(await call(page, 'send_message', { email: 'not an email', message: 'Where is my tea?' })).toMatchObject({ isError: true, text: expect.stringContaining('email') })
  await expect(page.getByLabel('Email')).toHaveValue('')

  expect(await call(page, 'send_message', { email: 'daniel@example.com', message: 'Where is my tea?' })).toEqual({ text: 'Sent. We will reply to daniel@example.com.', isError: false })
  await expect(page.getByLabel('Email')).toHaveValue('daniel@example.com')
  await expect(page.getByTestId('sent')).toHaveText('order: Where is my tea?')
  await expect(page).toHaveNoErrorsOrWarnings()
})

test('only fills in fields the user could edit', async ({ page, goto }) => {
  await goto('/settings')
  await expect.poll(() => names(page)).toEqual(['navigate', 'save_settings'])

  const [saveSettings] = (await tools(page)).filter(tool => tool.name === 'save_settings')
  expect(saveSettings!.inputSchema.properties).toEqual({
    name: { type: 'string', description: 'Name', default: 'Daniel' },
    password: { type: 'string', description: 'Password' },
    role: { type: 'string' },
    plan: { type: 'string', description: 'Plan', default: 'free' },
    tier: { type: 'string', description: 'Tier', default: 'basic' },
    legacyTier: { type: 'string', description: 'Legacy tier', default: 'basic' },
    trialTier: { type: 'string', description: 'Trial tier', default: 'basic' },
  })

  expect(await call(page, 'save_settings', { role: 'admin', plan: 'pro', legacyTier: 'plus', trialTier: 'plus' })).toEqual({
    isError: true,
    text: 'The form was not submitted. role: this field is not on the page; plan: this field cannot be changed; legacyTier: this field cannot be changed; trialTier: this field cannot be changed',
  })
  await expect(page.getByTestId('saved')).toHaveText('')

  expect(await call(page, 'save_settings', { name: 'Sarah', tier: 'plus' })).toEqual({ text: 'Saved.', isError: false })
  await expect(page.getByTestId('saved')).toHaveText('Sarah, member, free, plus, basic, basic')
  await expect(page).toHaveNoErrorsOrWarnings()
})

test('swaps page tools when the agent navigates', async ({ page, goto }) => {
  await goto('/')
  await expect.poll(() => names(page)).toContain('add_to_cart')

  expect(await call(page, 'navigate', { path: '/contact' })).toMatchObject({ isError: false, text: expect.stringContaining('"path":"/contact"') })
  await expect.poll(() => names(page)).toEqual(['navigate', 'send_message'])
})
