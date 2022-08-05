import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import type { ExecaChildProcess } from 'execa'
import type { Browser, LaunchOptions } from 'playwright'

export type TestRunner = 'vitest' | 'jest'

export interface TestOptions {
  testDir: string
  fixture: string
  configFile: string
  rootDir: string
  buildDir: string
  nuxtConfig: NuxtConfig
  build: boolean
  dev: boolean
  setupTimeout: number
  waitFor: number
  browser: boolean
  runner: TestRunner
  logLevel: number
  browserOptions: {
    type: 'chromium' | 'firefox' | 'webkit'
    launch?: LaunchOptions
  }
  server: boolean
}

export interface TestContext {
  options: TestOptions
  nuxt?: Nuxt
  browser?: Browser
  url?: string
  serverProcess?: ExecaChildProcess
}

export interface TestHooks {
  beforeEach: () => void
  afterEach: () => void
  afterAll: () => void
  setup: () => void
  ctx: TestContext
}
