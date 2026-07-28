import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtApp, ResolvedNuxtTemplate } from 'nuxt/schema'
import { createChangedFileFilter } from '../src/core/template-dependencies.ts'

const nuxt = {} as Nuxt

function createApp (templates: Array<Partial<ResolvedNuxtTemplate<any>>>, overrides: Partial<NuxtApp> = {}) {
  return {
    plugins: [],
    templates,
    ...overrides,
  } as unknown as NuxtApp
}

const select = (app: NuxtApp, path: string) => {
  const filter = createChangedFileFilter(nuxt, app, path)
  return filter ? app.templates.filter(t => filter(t as ResolvedNuxtTemplate<any>)).map(t => t.filename) : undefined
}

describe('createChangedFileFilter', () => {
  it('skips regeneration when no template can be affected', () => {
    const app = createApp([{ filename: 'a.mjs', dependsOn: [] }, { filename: 'b.mjs', dependsOn: [] }])
    expect(createChangedFileFilter(nuxt, app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('regenerates templates that do not declare a dependency', () => {
    const app = createApp([{ filename: 'a.mjs', dependsOn: [] }, { filename: 'my-module.mjs' }])
    expect(select(app, '/src/components/Foo.vue')).toStrictEqual(['my-module.mjs'])
  })

  it('regenerates templates whose declared predicate matches the changed file', () => {
    const app = createApp([
      { filename: 'a.mjs', dependsOn: ({ path }) => path.endsWith('.yaml') },
      { filename: 'b.mjs', dependsOn: [] },
    ])

    expect(select(app, '/src/content.yaml')).toStrictEqual(['a.mjs'])
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('passes the change and context to a declared predicate', () => {
    const app = createApp([
      { filename: 'a.mjs', options: { dir: '/src/plugins' }, dependsOn: (change, ctx: any) => change.event === 'change' && ctx.nuxt === nuxt && ctx.app === app && change.path.startsWith(ctx.options.dir) },
    ])

    expect(select(app, '/src/plugins/foo.ts')).toStrictEqual(['a.mjs'])
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('matches the `plugins` dependency against plugin sources', () => {
    const app = createApp(
      [{ filename: 'plugins.mjs', dependsOn: ['plugins'] }, { filename: 'a.mjs', dependsOn: [] }],
      { plugins: [{ src: '/src/plugins/foo.ts' }] },
    )

    expect(select(app, '/src/plugins/foo.ts')).toStrictEqual(['plugins.mjs'])
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('matches the `pages` dependency against page sources, including nested pages', () => {
    const app = createApp(
      [{ filename: 'routes.mjs', dependsOn: ['pages'] }, { filename: 'a.mjs', dependsOn: [] }],
      { pages: [{ file: '/src/pages/index.vue', children: [{ file: '/src/pages/nested.vue' }] }] as NuxtApp['pages'] },
    )

    expect(select(app, '/src/pages/index.vue')).toStrictEqual(['routes.mjs'])
    expect(select(app, '/src/pages/nested.vue')).toStrictEqual(['routes.mjs'])
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('does not match the `pages` dependency when the pages module is disabled', () => {
    const app = createApp([{ filename: 'route-rules.mjs', dependsOn: ['pages'] }])
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('does not match the `pages` dependency when every page has been removed', () => {
    const app = createApp([{ filename: 'routes.mjs', dependsOn: ['pages'] }], { pages: [] })
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })

  it('matches platform-native paths against the normalised changed path', () => {
    const app = createApp(
      [
        { filename: 'from-src.mjs', src: 'C:\\app\\some-template.mjs' },
        { filename: 'routes.mjs', dependsOn: ['pages'] },
        { filename: 'plugins.mjs', dependsOn: ['plugins'] },
      ],
      {
        pages: [{ file: 'C:\\app\\pages\\index.vue' }] as NuxtApp['pages'],
        plugins: [{ src: 'C:\\app\\plugins\\foo.ts' }],
      },
    )

    expect(select(app, 'C:/app/some-template.mjs')).toStrictEqual(['from-src.mjs'])
    expect(select(app, 'C:/app/pages/index.vue')).toStrictEqual(['routes.mjs'])
    expect(select(app, 'C:/app/plugins/foo.ts')).toStrictEqual(['plugins.mjs'])
  })

  it('regenerates a file-backed template only when its own source changes', () => {
    const app = createApp([
      { filename: 'from-src.mjs', src: '/src/some-template.mjs' },
      { filename: 'a.mjs', dependsOn: [] },
    ])

    expect(select(app, '/src/some-template.mjs')).toStrictEqual(['from-src.mjs'])
    expect(select(app, '/src/components/Foo.vue')).toBeUndefined()
  })
})
