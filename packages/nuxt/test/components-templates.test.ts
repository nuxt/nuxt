import { describe, expect, it } from 'vitest'

import { componentsDeclarationTemplate, componentsTypeTemplate } from '../src/components/templates.ts'
import { BUILTIN_COMPONENT_META, getBuiltinComponentMeta } from '../src/components/builtin-metadata.ts'
import type { Component, ComponentMeta } from '@nuxt/schema'
import type { Nuxt, NuxtApp } from 'nuxt/schema'

function makeNuxt (): Nuxt {
  return {
    options: {
      rootDir: '/root',
      buildDir: '/root/.nuxt',
      experimental: { typescriptPlugin: false, componentIslands: false },
    },
  } as unknown as Nuxt
}

function makeComponent (overrides: Partial<Component> & Pick<Component, 'pascalName' | 'filePath'>): Component {
  return {
    kebabName: overrides.pascalName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
    chunkName: `components/${overrides.pascalName}`,
    export: 'default',
    shortPath: overrides.filePath,
    prefetch: false,
    preload: false,
    mode: 'all',
    priority: 10,
    meta: {},
    ...overrides,
  }
}

async function renderTemplates (components: Component[]) {
  const app = { components, pages: [] } as unknown as NuxtApp
  const nuxt = makeNuxt()
  const declaration = await componentsDeclarationTemplate.getContents!({ app, nuxt, options: {} })
  const types = await componentsTypeTemplate.getContents!({ app, nuxt, options: {} })
  return { declaration, types }
}

describe('component type templates', () => {
  it('emits JSDoc from component meta for declaration and GlobalComponents entries', async () => {
    const docsUrl = 'https://nuxt.com/docs/4.x/api/components/nuxt-layout'
    const { declaration, types } = await renderTemplates([
      makeComponent({
        pascalName: 'NuxtLayout',
        filePath: '/root/app/components/nuxt-layout',
        meta: {
          description: 'Renders the selected layout around pages or error content.',
          docsUrl,
        },
      }),
      makeComponent({
        pascalName: 'PlainThing',
        filePath: '/root/components/PlainThing.vue',
      }),
    ])

    const layoutJsDoc = [
      '/**',
      ' * Renders the selected layout around pages or error content.',
      ' *',
      ` * @see ${docsUrl}`,
      ' */',
    ].join('\n')
    const lazyLayoutJsDoc = [
      '/**',
      ' * Lazy-loaded version of `<NuxtLayout>`.',
      ' *',
      ' * Renders the selected layout around pages or error content.',
      ' *',
      ` * @see ${docsUrl}`,
      ' */',
    ].join('\n')
    const indentJsDoc = (jsDoc: string) => jsDoc.split('\n').map(line => `  ${line}`).join('\n')

    expect(declaration).toContain(`${layoutJsDoc}\nexport const NuxtLayout:`)
    expect(declaration).toContain(`${lazyLayoutJsDoc}\nexport const LazyNuxtLayout:`)
    expect(types).toContain(`${indentJsDoc(layoutJsDoc)}\n  NuxtLayout:`)
    expect(types).toContain(`${indentJsDoc(lazyLayoutJsDoc)}\n  LazyNuxtLayout:`)

    expect(declaration).toMatch(/export const PlainThing:/)
    expect(declaration).not.toMatch(/\/\*\*[\s\S]*\*\/\nexport const PlainThing:/)
    expect(declaration).not.toMatch(/\/\*\*[\s\S]*\*\/\nexport const LazyPlainThing:/)
    expect(types).not.toMatch(/\/\*\*[\s\S]*\*\/\n {2}PlainThing:/)
    expect(types).not.toMatch(/\/\*\*[\s\S]*\*\/\n {2}LazyPlainThing:/)
  })

  it('escapes comment terminators in component meta', async () => {
    const { declaration, types } = await renderTemplates([
      makeComponent({
        pascalName: 'UnsafeDocs',
        filePath: '/root/components/UnsafeDocs.vue',
        meta: {
          description: 'Ends early */ still documented',
          docsUrl: 'https://example.com/*/docs',
        },
      }),
    ])

    expect(declaration).toContain('Ends early * / still documented')
    expect(declaration).toContain('@see https://example.com/* /docs')
    expect(declaration).not.toContain('Ends early */ still documented')
    expect(types).toContain('Ends early * / still documented')
    expect(types).not.toMatch(/\*\/\nexport const UnsafeDocs:/)
  })
})

describe('builtin component metadata', () => {
  const expectedNames = [
    'ClientOnly',
    'DevOnly',
    'NuxtClientFallback',
    'NuxtPage',
    'NuxtLayout',
    'NuxtLink',
    'NuxtLoadingIndicator',
    'NuxtErrorBoundary',
    'NuxtWelcome',
    'NuxtIsland',
    'NuxtImg',
    'NuxtPicture',
    'NuxtRouteAnnouncer',
    'NuxtTime',
    'NuxtAnnouncer',
  ] as const

  it('covers exactly the public built-in components with unique docs URLs', () => {
    expect(Object.keys(BUILTIN_COMPONENT_META).sort()).toEqual([...expectedNames].sort())

    const docsUrls = Object.values(BUILTIN_COMPONENT_META).map(meta => meta.docsUrl)
    expect(new Set(docsUrls).size).toBe(docsUrls.length)

    for (const name of expectedNames) {
      const meta = getBuiltinComponentMeta(name)
      expect(meta.description?.trim().length).toBeGreaterThan(0)
      expect(meta.description).toMatch(/[.!?]$/)
      expect(meta.description).not.toMatch(/^Nuxt provides\b/)
      expect(meta.docsUrl).toMatch(/^https:\/\/nuxt\.com\/docs\/4\.x\/api\/components\//)
    }
  })

  it('returns typed hover metadata for NuxtLayout', () => {
    const meta: ComponentMeta = getBuiltinComponentMeta('NuxtLayout')
    expect(meta).toEqual({
      description: 'Renders the selected layout around pages or error content.',
      docsUrl: 'https://nuxt.com/docs/4.x/api/components/nuxt-layout',
    })
  })
})
