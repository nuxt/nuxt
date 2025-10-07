import { resolve } from 'pathe'
import { consola } from 'consola'
import { expect, it, vi } from 'vitest'

import { scanComponents } from '../src/components/scan'
import { componentsFixtureDir } from './utils'
import type { ComponentsDir } from 'nuxt/schema'

const rFixture = (...p: string[]) => resolve(componentsFixtureDir, ...p)

vi.mock('@nuxt/kit', () => ({
  isIgnored: () => false,
  useLogger: () => consola.create({}).withTag('nuxt'),
}))

const dirs: ComponentsDir[] = [
  {
    path: rFixture('components/islands'),
    extensions: [
      'vue',
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts',
    ],
    transpile: false,
    island: true,
  },
  {
    path: rFixture('components/global'),
    extensions: [
      'vue',
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts',
    ],
    transpile: false,
    global: true,
  },
  {
    path: rFixture('components'),
    extensions: [
      'vue',
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts',
    ],
    transpile: false,
  },
  {
    path: rFixture('components'),
    extensions: [
      'vue',
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts',
    ],
    transpile: false,
  },
  {
    path: rFixture('components'),
    extensions: [
      'vue',
    ],
    prefix: 'nuxt',
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts',
    ],
    transpile: false,
  },
]
const expectedComponents = [
  {
    chunkName: 'components/isle-server',
    declarationPath: rFixture('components/islands/Isle.vue'),
    export: 'default',
    global: undefined,
    island: true,
    kebabName: 'isle',
    mode: 'server',
    pascalName: 'Isle',
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    chunkName: 'components/glob',
    declarationPath: rFixture('components/global/Glob.vue'),
    export: 'default',
    global: true,
    island: undefined,
    kebabName: 'glob',
    mode: 'all',
    pascalName: 'Glob',
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    mode: 'all',
    pascalName: 'HelloWorld',
    kebabName: 'hello-world',
    chunkName: 'components/hello-world',
    declarationPath: rFixture('components/HelloWorld.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    mode: 'client',
    pascalName: 'Nuxt3',
    kebabName: 'nuxt3',
    chunkName: 'components/nuxt3-client',
    declarationPath: rFixture('components/Nuxt3.client.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    mode: 'server',
    pascalName: 'Nuxt3',
    kebabName: 'nuxt3',
    chunkName: 'components/nuxt3-server',
    declarationPath: rFixture('components/Nuxt3.server.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    chunkName: 'components/client-component-with-props',
    declarationPath: rFixture('components/client/ComponentWithProps.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    kebabName: 'client-component-with-props',
    mode: 'all',
    pascalName: 'ClientComponentWithProps',
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    chunkName: 'components/client-with-client-only-setup',
    declarationPath: rFixture('components/client/WithClientOnlySetup.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    kebabName: 'client-with-client-only-setup',
    mode: 'all',
    pascalName: 'ClientWithClientOnlySetup',
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    mode: 'server',
    pascalName: 'ParentFolder',
    kebabName: 'parent-folder',
    chunkName: 'components/parent-folder-server',
    declarationPath: rFixture('components/parent-folder/index.server.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    chunkName: 'components/same-name-same',
    declarationPath: rFixture('components/same-name/same/Same.vue'),
    export: 'default',
    global: undefined,
    island: undefined,
    kebabName: 'same-name-same',
    mode: 'all',
    pascalName: 'SameNameSame',
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    chunkName: 'components/some-glob',
    declarationPath: rFixture('components/some-glob.global.vue'),
    export: 'default',
    global: true,
    island: undefined,
    kebabName: 'some-glob',
    mode: 'all',
    pascalName: 'SomeGlob',
    prefetch: false,
    preload: false,
    priority: 1,
  },
  {
    chunkName: 'components/some-server',
    declarationPath: rFixture('components/some.island.vue'),
    export: 'default',
    global: undefined,
    island: true,
    kebabName: 'some',
    mode: 'server',
    pascalName: 'Some',
    prefetch: false,
    preload: false,
    priority: 1,
  },
]

it('components:scanComponents', async () => {
  const scannedComponents = await scanComponents(dirs)
  for (const c of scannedComponents) {
    // @ts-expect-error filePath is not optional but we don't want it to be in the snapshot
    delete c.filePath
    // @ts-expect-error _scanned is added internally but we don't want it to be in the snapshot
    delete c._scanned
  }
  expect(scannedComponents).deep.eq(expectedComponents)
})
