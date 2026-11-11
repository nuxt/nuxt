import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { createServerBuild, setServerBuild } from '@nuxt/kit/internal'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'

import { DeployTargetPlugin } from '../src/target.ts'

function setup ({ dev = false, plugins = [] as PluginOption[] } = {}) {
  const nuxt = {
    options: { dev, rootDir: '/app', buildDir: '/app/.nuxt', vite: { plugins } },
  } as unknown as Nuxt
  nuxt.serverBuild = createServerBuild(nuxt.options)
  setServerBuild({ runtime: { runtimeConfig: '/app/.nuxt/vite-server/runtime-config.mjs', handler: dev ? undefined : '/app/.output/server/index.mjs' } }, nuxt)

  const { plugin, target } = DeployTargetPlugin(nuxt)
  const resolve = (plugins: Plugin[]) => {
    (plugin.configResolved as (config: ResolvedConfig) => void)({ plugins } as unknown as ResolvedConfig)
  }
  const claimServerEnvironment = () => {
    nuxt.serverBuild.runtime.handler = undefined
  }
  return { target, resolve, claimServerEnvironment }
}

const plugins = (...names: string[]): Plugin[] => names.map(name => ({ name }))

const cloudflare = () => plugins('vite-plugin-cloudflare', 'vite-plugin-cloudflare:nodejs-compat')
const netlify = ({ build = false } = {}) => [{ name: 'vite-plugin-netlify' }, ...build ? [{ name: 'vite-plugin-netlify:build', apply: 'build' as const }] : []]
const vercel = () => plugins('vite-plugin-vercel:api', 'vite-plugin-vercel:setup-envs')
const universalDeploy = () => [{ name: 'ud:catch-all' }, { name: 'ud:node:emit', apply: 'build' as const }]

describe('the deploy target', () => {
  it.each([
    [undefined, 'without a deploy plugin', []],
    ['cloudflare', 'with cloudflare', [cloudflare()]],
    ['netlify', 'with netlify', [netlify({ build: true })]],
    [undefined, 'with netlify when nothing builds the function', [netlify()]],
    ['vercel', 'with vercel', [vercel()]],
    [undefined, 'with universal-deploy', [universalDeploy()]],
    ['cloudflare', 'with universal-deploy and cloudflare', [universalDeploy(), cloudflare()]],
    [undefined, 'with a plugin that is still a promise', [Promise.resolve(cloudflare())]],
    [undefined, 'with a plugin that applies conditionally', [{ name: 'vite-plugin-cloudflare', apply: () => true }]],
  ] as Array<[string | undefined, string, PluginOption[]]>)('is %s %s before the config is resolved', (expected, _, configured) => {
    const { target } = setup({ plugins: configured })

    expect(target()).toBe(expected)
  })

  it('is detected from the configured plugins that apply to the command', () => {
    const { target } = setup({ dev: true, plugins: [netlify({ build: true })] })

    expect(target()).toBeUndefined()
  })

  it('is node for netlify when nothing builds the function', () => {
    const { target, resolve } = setup({ plugins: [netlify()] })

    resolve(netlify())
    expect(target()).toBe('node')
  })

  it('is node once the config is resolved without a deploy plugin', () => {
    const { target, resolve } = setup()

    expect(target()).toBeUndefined()
    resolve(plugins('vite:build'))
    expect(target()).toBe('node')
  })

  it('is detected from the resolved plugins once the config is resolved', () => {
    const { target, resolve } = setup({ plugins: [Promise.resolve(cloudflare())] })

    resolve(cloudflare())
    expect(target()).toBe('cloudflare')
    resolve([])
    expect(target()).toBe('node')
  })

  it('is node for the universal-deploy node adapter that claims the server environment', () => {
    const { target, resolve, claimServerEnvironment } = setup({ plugins: [universalDeploy()] })

    claimServerEnvironment()
    resolve(universalDeploy())
    expect(target()).toBe('node')
  })

  it('is unknown for an unrecognised target that claims the server environment', () => {
    const { target, resolve, claimServerEnvironment } = setup({ plugins: [universalDeploy(), netlify()] })

    claimServerEnvironment()
    resolve([...plugins('ud:catch-all', 'ud:node:emit:disabled'), ...netlify()])
    expect(target()).toBeUndefined()
  })

  it('is node in development without a recognised plugin', () => {
    const { target, resolve } = setup({ dev: true })

    resolve(plugins('vite:dev'))
    expect(target()).toBe('node')
  })
})
