import type { Import, InlinePreset, PackagePreset, Preset, UnimportOptions } from 'unimport'
import type { Manifest } from 'vue-bundle-renderer'
import { describe, expectTypeOf, it } from 'vitest'

import type { ImportsOptions, NuxtImport, NuxtImportPreset, NuxtImportPresetSource, NuxtPackageImportPreset } from '../src/types/imports.ts'
import type { NuxtManifest } from '../src/types/manifest.ts'

// Nuxt describes these contracts itself so that the implementation behind them can change without
// breaking module authors. Nothing else pins them to the libraries that currently satisfy them, so
// a bump of one of those libraries would otherwise diverge silently.

describe('auto-import contracts', () => {
  it('accept what unimport produces', () => {
    expectTypeOf<Import>().toExtend<NuxtImport>()
    expectTypeOf<InlinePreset>().toExtend<NuxtImportPreset>()
    expectTypeOf<PackagePreset>().toExtend<NuxtPackageImportPreset>()
    expectTypeOf<Preset>().toExtend<NuxtImportPresetSource>()
  })

  it('produce what unimport accepts', () => {
    expectTypeOf<NuxtImport>().toExtend<Import>()
    expectTypeOf<NuxtImportPresetSource>().toExtend<Preset>()
  })

  it('cover every `imports` option unimport supports', () => {
    expectTypeOf<Exclude<keyof UnimportOptions, keyof ImportsOptions>>().toEqualTypeOf<never>()
  })

  it('name the same presets unimport resolves', () => {
    expectTypeOf<ImportsOptions['presets']>().toEqualTypeOf<UnimportOptions['presets'] | undefined>()
  })

  it('can be handed to `createUnimport` unchanged', () => {
    expectTypeOf<ImportsOptions>().toExtend<Partial<UnimportOptions>>()
  })
})

describe('`build:manifest` contract', () => {
  it('is interchangeable with the renderer manifest it is built from', () => {
    expectTypeOf<Manifest>().toExtend<NuxtManifest>()
    expectTypeOf<NuxtManifest>().toExtend<Manifest>()
  })
})
