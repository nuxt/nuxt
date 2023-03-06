import {createTestContext, setTestContext, useTestContext} from '../context'
import {loadFixture, buildFixture, resolveRootDir} from '../nuxt'
import {startDevServer, startServer, stopServer} from '../server'
import { createBrowser } from '../browser'
import type { TestHooks, TestOptions } from '../types'
import setupJest from './jest'
import setupVitest from './vitest'
import {resolve} from "node:path";
import {promises as fsp} from "node:fs";

export const setupMaps = {
  jest: setupJest,
  vitest: setupVitest
}

export function createTest (options: Partial<TestOptions>): TestHooks {
  const ctx = createTestContext(options)

  const beforeEach = () => {
    setTestContext(ctx)
  }

  const afterEach = () => {
    setTestContext(undefined)
  }

  const afterAll = async () => {
    if (ctx.serverProcess) {
      setTestContext(ctx)
      await stopServer()
      setTestContext(undefined)
    }
    if (ctx.nuxt && ctx.nuxt.options.dev) {
      await ctx.nuxt.close()
    }
    if (ctx.browser) {
      await ctx.browser.close()
    }
  }

  const setup = async () => {
    const ctx = useTestContext()
    ctx.options.rootDir = resolveRootDir()

    // always output to a random build dir
    const randomId = Math.random().toString(36).slice(2, 8)
    const buildDir = resolve(ctx.options.rootDir, '.nuxt', randomId)
    Object.assign(ctx.options.nuxtConfig, {
      buildDir,
      nitro: {
        output: {
          dir: resolve(buildDir, 'output')
        }
      }
    })
    await fsp.mkdir(buildDir, { recursive: true })

    if (ctx.options.devServer) {
      await startDevServer()
    }
    if (ctx.options.fixture) {
      await loadFixture()
    }

    if (ctx.options.build) {
      await buildFixture()
    }

    if (ctx.options.server) {
      await startServer()
    }

    if (ctx.options.waitFor) {
      await (new Promise(resolve => setTimeout(resolve, ctx.options.waitFor)))
    }

    if (ctx.options.browser) {
      await createBrowser()
    }
  }

  return {
    beforeEach,
    afterEach,
    afterAll,
    setup,
    ctx
  }
}

export async function setup (options: Partial<TestOptions> = {}) {
  const hooks = createTest(options)

  const setupFn = setupMaps[hooks.ctx.options.runner]

  await setupFn(hooks)
}
