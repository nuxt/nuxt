import type { ConsolaInstance, ConsolaOptions } from 'consola'
import type { Defu } from 'defu'
import type { Hookable } from 'hookable'
import type { Ignore } from 'ignore'
import type { SnakeCase } from 'scule'
import { describe, expectTypeOf, it } from 'vitest'

import type { NuxtHookRegistry, NuxtHooks, NuxtIgnoreMatcher } from '@nuxt/schema'
import type { Merged } from '../../schema/src/types/merge.ts'
import type { SnakeCase as NuxtSnakeCase } from '../../schema/src/types/case.ts'
import type { NuxtLogger, NuxtLoggerOptions } from '../src/logger.ts'

// Nuxt describes these contracts itself so that the implementation behind them can change without
// breaking module authors. Nothing else pins them to the libraries that currently satisfy them, so
// a bump of one of those libraries would otherwise diverge silently.

describe('logger contract', () => {
  it('is satisfied by consola', () => {
    expectTypeOf<ConsolaInstance>().toExtend<NuxtLogger>()
  })

  it('accepts and produces consola options', () => {
    expectTypeOf<Partial<ConsolaOptions>>().toExtend<NuxtLoggerOptions>()
    expectTypeOf<NuxtLoggerOptions>().toExtend<Partial<ConsolaOptions>>()
  })
})

describe('hook registry contract', () => {
  it('is satisfied by hookable', () => {
    expectTypeOf<Hookable<NuxtHooks>>().toExtend<NuxtHookRegistry<NuxtHooks>>()
  })
})

describe('ignore matcher contract', () => {
  it('is satisfied by `ignore`', () => {
    expectTypeOf<Ignore>().toExtend<NuxtIgnoreMatcher>()
  })
})

describe('`SnakeCase`', () => {
  type Sample = 'foo' | 'fooBar' | 'foo_bar' | 'foo-bar' | 'foo.bar' | 'foo/bar' | 'FOO' | 'FOOBar' | 'fooBARBaz' | 'apiURL' | 'someHTTPServer' | 'x1Y2' | 'a'

  it('matches scule, which determines the documented environment variable names', () => {
    expectTypeOf<{ [K in Sample]: NuxtSnakeCase<K> }>().toEqualTypeOf<{ [K in Sample]: SnakeCase<K> }>()
  })
})

describe('`Merged`', () => {
  interface Options {
    string?: string
    nested?: { number?: number, array?: string[] }
    array?: number[]
    fn?: () => void
    boolean?: boolean
  }
  interface Defaults {
    string: string
    nested: { number: number }
    array: number[]
    boolean: false
  }

  it('matches defu, which determines what `defineNuxtModule` resolves options to', () => {
    expectTypeOf<Merged<Partial<Options>, [Defaults]>>().toEqualTypeOf<Defu<Partial<Options>, [Defaults]>>()
    expectTypeOf<Merged<Partial<Options>, [Partial<Options>, Defaults]>>().toEqualTypeOf<Defu<Partial<Options>, [Partial<Options>, Defaults]>>()
  })
})
