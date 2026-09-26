import { describe, it } from 'vitest'
import type { Hookable } from 'hookable'
import type { NuxtHookRegistry } from '../src/types/hookable.ts'

// the registry is a `hookable` instance at runtime, so the declared contract has to accept
// what `hookable` accepts and reject what it rejects

interface Hooks {
  'ready': () => void
  'build:done': (a: number) => void
  'app:suspense:resolve': () => void
}

/** A map opened up by a module that registers hook names it declares elsewhere. */
interface OpenHooks extends Hooks {
  [key: string]: (...args: any[]) => any
}

const noop = () => () => {}
const nuxt = { hook: noop, callHook: noop, addHooks: noop } as unknown as NuxtHookRegistry<Hooks>
const hookable = { hook: noop, callHook: noop, addHooks: noop } as unknown as Hookable<Hooks>
const openNuxt = { hook: noop, callHook: noop, addHooks: noop } as unknown as NuxtHookRegistry<OpenHooks>
const openHookable = { hook: noop, callHook: noop, addHooks: noop } as unknown as Hookable<OpenHooks>

describe('a closed hook map', () => {
  it('rejects undeclared names, as `hookable` does', () => {
    // @ts-expect-error not a declared hook
    hookable.hook('module:arbitrary', () => {})
    // @ts-expect-error not a declared hook
    nuxt.hook('module:arbitrary', () => {})
    // @ts-expect-error not a declared hook
    nuxt.callHook('module:arbitrary')
  })

  it('accepts the nested form, including multi-segment names', () => {
    nuxt.addHooks({ build: { done: (a: number) => a } })
    nuxt.addHooks({ app: { suspense: { resolve: () => {} } } })
  })
})

describe('a hook map opened with an index signature', () => {
  it('accepts arbitrary names, as `hookable` does', () => {
    openHookable.hook('anything:at:all', () => {})
    openNuxt.hook('anything:at:all', () => {})
    openNuxt.callHook('anything:at:all')
  })

  it('still accepts the nested form for its declared names', () => {
    openNuxt.addHooks({ build: { done: (a: number) => a } })
    openNuxt.addHooks({ app: { suspense: { resolve: () => {} } } })
  })

  it('still accepts the flat form', () => {
    openNuxt.addHooks({ 'build:done': (a: number) => a })
    openNuxt.addHooks({ 'anything:at:all': () => {} })
  })
})
