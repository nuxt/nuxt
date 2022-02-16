import { resolve } from 'path'
import defu from 'defu'
import type { TestContext, TestOptions, TestRunner } from './types'

let currentContext: TestContext

export function createTestContext (options: Partial<TestOptions>): TestContext {
  const _options: Partial<TestOptions> = defu(options, {
    testDir: resolve(process.cwd(), 'test'),
    fixture: 'fixture',
    configFile: 'nuxt.config',
    setupTimeout: 60000,
    logLevel: 1,
    server: options.browser,
    build: options.browser || options.server,
    nuxtConfig: {},
    // TODO: auto detect based on process.env
    runner: <TestRunner>'vitest',
    browserOptions: {
      type: 'chromium'
    }
  })

  return setTestContext({ options: _options as TestOptions })
}

export function useTestContext (): TestContext {
  if (!currentContext) {
    throw new Error('No context is available. (Forgot calling setup or createContext?)')
  }
  return currentContext
}

export function setTestContext (context: TestContext): TestContext {
  currentContext = context
  return currentContext
}
