import { resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import type { ComponentsDir } from 'nuxt/schema'

import { scanComponents } from '../src/components/scan'

const fixtureDir = resolve(__dirname, 'fixture')
const rFixture = (...p: string[]) => resolve(fixtureDir, ...p)

vi.mock('@nuxt/kit', () => ({
  isIgnored: () => false
}))

const dirs: ComponentsDir[] = [
  {
    path: rFixture('components/islands'),
    enabled: true,
    extensions: [
      'vue'
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts'
    ],
    transpile: false,
    island: true
  },
  {
    path: rFixture('components/global'),
    enabled: true,
    extensions: [
      'vue'
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts'
    ],
    transpile: false,
    global: true
  },
  {
    path: rFixture('components'),
    enabled: true,
    extensions: [
      'vue'
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts'
    ],
    transpile: false
  },
  {
    path: rFixture('components'),
    enabled: true,
    extensions: [
      'vue'
    ],
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts'
    ],
    transpile: false
  },
  {
    path: rFixture('components'),
    extensions: [
      'vue'
    ],
    prefix: 'nuxt',
    enabled: true,
    pattern: '**/*.{vue,}',
    ignore: [
      '**/*.stories.{js,ts,jsx,tsx}',
      '**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}',
      '**/*.d.ts'
    ],
    transpile: false
  }
]

const expectedComponents = [
  {
    chunkName: 'components/isle-server',
    export: 'default',
    global: undefined,
    island: true,
    kebabName: 'isle',
    mode: 'server',
    pascalName: 'Isle',
    prefetch: false,
    preload: false,
    priority: 1,
    shortPath: 'components/islands/Isle.vue'
  },
  {
    chunkName: 'components/glob',
    export: 'default',
    global: true,
    island: undefined,
    kebabName: 'glob',
    mode: 'all',
    pascalName: 'Glob',
    prefetch: false,
    preload: false,
    priority: 1,
    shortPath: 'components/global/Glob.vue'
  },
  {
    mode: 'all',
    pascalName: 'HelloWorld',
    kebabName: 'hello-world',
    chunkName: 'components/hello-world',
    shortPath: 'components/HelloWorld.vue',
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1
  },
  {
    mode: 'client',
    pascalName: 'Nuxt3',
    kebabName: 'nuxt3',
    chunkName: 'components/nuxt3-client',
    shortPath: 'components/Nuxt3.client.vue',
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1
  },
  {
    mode: 'server',
    pascalName: 'Nuxt3',
    kebabName: 'nuxt3',
    chunkName: 'components/nuxt3-server',
    shortPath: 'components/Nuxt3.server.vue',
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1
  },
  {
    chunkName: 'components/client-component-with-props',
    export: 'default',
    global: undefined,
    island: undefined,
    kebabName: 'client-component-with-props',
    mode: 'all',
    pascalName: 'ClientComponentWithProps',
    prefetch: false,
    preload: false,
    priority: 1,
    shortPath: 'components/client/ComponentWithProps.vue'
  },
  {
    chunkName: 'components/client-with-client-only-setup',
    export: 'default',
    global: undefined,
    island: undefined,
    kebabName: 'client-with-client-only-setup',
    mode: 'all',
    pascalName: 'ClientWithClientOnlySetup',
    prefetch: false,
    preload: false,
    priority: 1,
    shortPath: 'components/client/WithClientOnlySetup.vue'
  },
  {
    mode: 'server',
    pascalName: 'ParentFolder',
    kebabName: 'parent-folder',
    chunkName: 'components/parent-folder-server',
    shortPath: 'components/parent-folder/index.server.vue',
    export: 'default',
    global: undefined,
    island: undefined,
    prefetch: false,
    preload: false,
    priority: 1
  },
  {
    chunkName: 'components/some-glob',
    export: 'default',
    global: true,
    island: undefined,
    kebabName: 'some-glob',
    mode: 'all',
    pascalName: 'SomeGlob',
    prefetch: false,
    preload: false,
    priority: 1,
    shortPath: 'components/some-glob.global.vue'
  },
  {
    chunkName: 'components/some-server',
    export: 'default',
    global: undefined,
    island: true,
    kebabName: 'some',
    mode: 'server',
    pascalName: 'Some',
    prefetch: false,
    preload: false,
    priority: 1,
    shortPath: 'components/some.island.vue'
  }
]

const srcDir = rFixture('.')

it('components:scanComponents', async () => {
  const scannedComponents = await scanComponents(dirs, srcDir)
  for (const c of scannedComponents) {
    // @ts-expect-error filePath is not optional but we don't want it to be in the snapshot
    delete c.filePath
  }
  expect(scannedComponents).deep.eq(expectedComponents)
})
