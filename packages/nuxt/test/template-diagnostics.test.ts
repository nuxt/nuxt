import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { dirname, join, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import type { CompilerOptions } from '@vue/compiler-core'
import type { Diagnostic } from 'nostics'
import { addRoute, createRouter, findRoute } from 'rou3'

import { createTemplateDiagnostics } from '../src/core/plugins/template-diagnostics.ts'
import type { TemplateDiagnosticsOptions } from '../src/core/plugins/template-diagnostics.ts'
import { createApp, generateApp } from '../src/core/app.ts'
import { loadNuxt } from '../src/index.ts'
import type { NuxtConfig } from '../schema.ts'

const repoRoot = await findWorkspaceDir()

const FILE = '/app/pages/index.vue'

function routeMatcher (patterns: string[]) {
  const router = createRouter()
  for (const pattern of patterns) {
    addRoute(router, '', pattern, true)
  }
  return (path: string) => !!findRoute(router, '', path)
}

const serverComponents = new Set(['ServerCard', 'server-card'])

function setup (options: TemplateDiagnosticsOptions = {}) {
  const warnings: Diagnostic<unknown>[] = []
  const diagnostics = createTemplateDiagnostics({
    getRouteMatcher: () => routeMatcher(['/', '/about', '/users/:id', '/docs/**']),
    getServerComponents: () => serverComponents,
    onWarning: diagnostic => warnings.push(diagnostic),
    ...options,
  })

  function compile (sfc: string, { ssr = false, inline = false, file = FILE } = {}) {
    const { descriptor } = parse(sfc, { filename: file })
    const compilerOptions = { nodeTransforms: [diagnostics.nodeTransform] }
    const script = descriptor.scriptSetup || descriptor.script
      ? compileScript(descriptor, { id: 'test', inlineTemplate: inline, templateOptions: { ssr, compilerOptions } })
      : undefined
    if (!inline) {
      const result = compileTemplate({ id: 'test', filename: file, source: descriptor.template!.content, ast: descriptor.template!.ast, ssr, ssrCssVars: [], compilerOptions: { ...compilerOptions, bindingMetadata: script?.bindings } })
      if (result.errors.length) {
        throw result.errors[0]
      }
    }
  }

  return { compile, warnings }
}

describe('template diagnostics', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  describe('NuxtLink routes', () => {
    it('warns about a static `to` that matches no route', () => {
      const { compile, warnings } = setup()
      compile(`<template>\n  <div>\n    <NuxtLink to="/abuot">About</NuxtLink>\n  </div>\n</template>\n`)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatchObject({
        name: 'NUXT_B4025',
        message: '`<NuxtLink to="/abuot">` in `/app/pages/index.vue` does not match any page route.',
        fix: expect.stringContaining('`external` prop'),
        docs: 'https://nuxt.com/docs/4.x/errors/b4025',
        sources: ['/app/pages/index.vue:3:15'],
      })
    })

    it.each([
      '/',
      '/about',
      '/about/',
      '/about?tab=1',
      '/about#team',
      '/users/42',
      '/docs/a/b/c',
      'https://nuxt.com',
      '//nuxt.com/x',
      'mailto:hi@nuxt.com',
      '#top',
      'relative',
    ])('accepts `%s`', (to) => {
      const { compile, warnings } = setup()
      compile(`<template><NuxtLink to="${to}" /></template>`)
      expect(warnings).toStrictEqual([])
    })

    it('reports a path that only a longer route would match', () => {
      const { compile, warnings } = setup()
      compile(`<template><NuxtLink to="/users" /></template>`)
      expect(warnings.map(warning => warning.name)).toStrictEqual(['NUXT_B4025'])
    })

    it('checks `href` and kebab-case tags', () => {
      const { compile, warnings } = setup()
      compile(`<template><nuxt-link href="/nope" /></template>`)
      expect(warnings).toMatchObject([{ name: 'NUXT_B4025', message: '`<nuxt-link href="/nope">` in `/app/pages/index.vue` does not match any page route.' }])
    })

    it.each([
      '<NuxtLink to="/nope" external />',
      '<NuxtLink to="/nope" :external="true" />',
      '<NuxtLink :to="\'/nope\'" />',
      '<NuxtLink to="/nope" v-bind="attrs" />',
      '<NuxtLink to="/nope" :[name]="value" />',
    ])('skips links it cannot resolve statically: %s', (link) => {
      const { compile, warnings } = setup()
      compile(`<template>${link}</template>`)
      expect(warnings).toStrictEqual([])
    })

    it('skips a locally imported `NuxtLink`', () => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nimport NuxtLink from './Link.vue'\n</script>\n<template><NuxtLink to="/nope" /></template>`)
      expect(warnings).toStrictEqual([])
    })

    it('skips the check without a route matcher', () => {
      const { compile, warnings } = setup({ getRouteMatcher: () => undefined })
      compile(`<template><NuxtLink to="/nope" /></template>`)
      expect(warnings).toStrictEqual([])
    })

    it('reports a link with slot content once across environments', () => {
      const { compile, warnings } = setup()
      const broken = `<template><NuxtLink to="/nope">About</NuxtLink></template>`
      compile(broken)
      compile(broken, { ssr: true })
      compile(broken)
      expect(warnings).toHaveLength(1)
    })

    it('checks an inlined template', () => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nconst a = 1\n</script>\n<template><NuxtLink to="/nope" /></template>`, { inline: true })
      expect(warnings).toMatchObject([{ name: 'NUXT_B4025', sources: ['/app/pages/index.vue:4:21'] }])
    })
  })

  describe('server component listeners', () => {
    it('warns about `v-on` and `v-model`', () => {
      const { compile, warnings } = setup()
      compile(`<template>\n  <ServerCard @click="go" v-model="value" />\n  <server-card v-on:hover="go" />\n</template>`)
      expect(warnings.map(warning => ({ name: warning.name, message: warning.message, sources: warning.sources }))).toStrictEqual([
        {
          name: 'NUXT_B3014',
          message: '`@click` is used on the server component `<ServerCard>` in `/app/pages/index.vue`, but server components render without client-side JavaScript, so they never emit events or update a `v-model`.',
          sources: ['/app/pages/index.vue:2:15'],
        },
        expect.objectContaining({ name: 'NUXT_B3014', sources: ['/app/pages/index.vue:2:27'] }),
        expect.objectContaining({ name: 'NUXT_B3014', sources: ['/app/pages/index.vue:3:16'] }),
      ])
      expect(warnings[0]!.fix).toContain('`ServerCard.client.vue`')
    })

    it.each([
      '@error="onError"',
      'v-on="listeners"',
      '@[event]="go"',
    ])('accepts %s', (listener) => {
      const { compile, warnings } = setup()
      compile(`<template><ServerCard ${listener} /></template>`)
      expect(warnings).toStrictEqual([])
    })

    it('ignores components that are not server-only', () => {
      const { compile, warnings } = setup()
      compile(`<template><ClientCard @click="go" /></template>`)
      expect(warnings).toStrictEqual([])
    })

    it('reports a warning once across environments and again after it was fixed', () => {
      const { compile, warnings } = setup()
      const broken = `<template><ServerCard @click="go" /></template>`
      compile(broken)
      compile(broken, { ssr: true })
      compile(broken)
      expect(warnings).toHaveLength(1)

      compile(`<template><ServerCard /></template>`)
      compile(`<template><ServerCard /></template>`, { ssr: true })
      compile(broken)
      expect(warnings).toHaveLength(2)
    })

    it('keeps a warning while another environment still raises it', () => {
      const { compile, warnings } = setup()
      const broken = `<template><ServerCard @click="go" /></template>`
      compile(broken)
      compile(broken, { ssr: true })
      compile(`<template><ServerCard /></template>`)
      compile(broken)
      expect(warnings).toHaveLength(1)
    })
  })

  describe('server component props', () => {
    it.each([
      [':format="(value) => value"', 'a function'],
      [':format="function () {}"', 'a function'],
      [':date="new Date()"', 'a class instance'],
      [':options="{ nested: { format: () => 1 } }"', 'a function'],
      [':options="{ format () {} }"', 'a function'],
      [':items="[1, () => 2]"', 'a function'],
      [':format="enabled ? (value) => value : undefined"', 'a function'],
      [':date="value || new Date()"', 'a class instance'],
    ])('warns about %s', (prop, value) => {
      const { compile, warnings } = setup()
      compile(`<template>\n  <ServerCard ${prop} />\n</template>`)
      expect(warnings).toMatchObject([{
        name: 'NUXT_B3015',
        message: expect.stringContaining(`is ${value}, which cannot be serialized`),
        sources: ['/app/pages/index.vue:2:15'],
      }])
    })

    it.each([
      '<ServerCard v-for="item in items" :item="item" />',
      '<div v-for="(item, index) of items"><ServerCard :item="item" :index="index" /></div>',
      '<List v-slot="{ item }"><ServerCard :item="item" /></List>',
      '<List><template #row="{ item: index }"><ServerCard :index="index" /></template></List>',
    ])('skips names a template scope declares: %s', (template) => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nfunction item () {}\nfunction index () {}\nconst items = [1]\n</script>\n<template>${template}</template>`)
      expect(warnings).toStrictEqual([])
    })

    it('checks a setup binding outside the template scope that shadows it', () => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nfunction item () {}\nconst items = [1]\n</script>\n<template><ServerCard v-slot="{ item }" :format="item"><span v-for="item in items">{{ item }}</span></ServerCard></template>`)
      expect(warnings).toMatchObject([{ name: 'NUXT_B3015', message: expect.stringContaining('The `format` prop') }])
    })

    it('resolves setup bindings that hold functions', () => {
      const { compile, warnings } = setup()
      compile(`<script setup lang="ts">\nconst format = (value: string) => value\nfunction other () {}\nconst options = { a: 1 }\nconst list = [1]\n</script>\n<template>\n  <ServerCard :format="format" />\n</template>`)
      expect(warnings).toMatchObject([{
        name: 'NUXT_B3015',
        message: 'The `format` prop passed to the server component `<ServerCard>` in `/app/pages/index.vue` is a function, which cannot be serialized to send to the server.',
        sources: ['/app/pages/index.vue:8:15'],
      }])
    })

    it.each([
      ':title="title"',
      ':options="options"',
      ':list="list"',
      ':count="count + 1"',
      ':label="count ? title : \'none\'"',
      ':title="title || \'x\'"',
      ':label="`n: ${count}`"',
      ':value="getValue()"',
      ':ref="(el) => {}"',
      ':key="getValue"',
      ':imported="helper"',
      'v-bind="options"',
    ])('accepts %s', (prop) => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nimport { helper } from './utils'\nconst title = 'x'\nconst options = { a: 1 }\nconst list = [1]\nconst count = 1\nfunction getValue () { return 1 }\n</script>\n<template><ServerCard ${prop} /></template>`)
      expect(warnings).toStrictEqual([])
    })
  })

  describe('NuxtIsland props', () => {
    it('warns about each value in `props` or `context` that cannot be serialized', () => {
      const { compile, warnings } = setup()
      compile(`<template>\n  <NuxtIsland name="ServerCard" :props="{ title: 'x', format: (value) => value, 'on-done' () {} }" :context="{ date: new Date() }" />\n</template>`)
      expect(warnings.map(warning => warning.message)).toStrictEqual([
        'The `format` prop passed to the server component `<NuxtIsland name="ServerCard">` in `/app/pages/index.vue` is a function, which cannot be serialized to send to the server.',
        'The `on-done` prop passed to the server component `<NuxtIsland name="ServerCard">` in `/app/pages/index.vue` is a function, which cannot be serialized to send to the server.',
        'The `date` prop passed to the server component `<NuxtIsland name="ServerCard">` in `/app/pages/index.vue` is a class instance, which cannot be serialized to send to the server.',
      ])
      expect(warnings[0]!.sources).toStrictEqual(['/app/pages/index.vue:2:33'])
    })

    it('resolves setup bindings and nested values', () => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nfunction format () {}\n</script>\n<template><nuxt-island name="ServerCard" :props="{ options: { format } }" /></template>`)
      expect(warnings).toMatchObject([{ name: 'NUXT_B3015', message: expect.stringContaining('The `options` prop passed to the server component `<nuxt-island name="ServerCard">`') }])
    })

    it.each([
      ':props="{ title: \'x\', count: 1, list: [1, 2], nested: { ok: true } }"',
      ':props="islandProps"',
      ':props="{ ...islandProps }"',
      ':other="{ format: () => 1 }"',
    ])('accepts %s', (prop) => {
      const { compile, warnings } = setup()
      compile(`<template><NuxtIsland name="ServerCard" ${prop} /></template>`)
      expect(warnings).toStrictEqual([])
    })

    it('skips a locally imported `NuxtIsland`', () => {
      const { compile, warnings } = setup()
      compile(`<script setup>\nimport NuxtIsland from './Island.vue'\n</script>\n<template><NuxtIsland name="ServerCard" :props="{ format: () => 1 }" /></template>`)
      expect(warnings).toStrictEqual([])
    })
  })
})

describe('template diagnostics in a Nuxt app', () => {
  async function loadApp (files: Record<string, string>, config: NuxtConfig = {}) {
    const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
    onTestFinished(() => rm(rootDir, { recursive: true, force: true }))
    for (const [name, contents] of Object.entries({ 'nuxt.config.ts': `export default ${JSON.stringify(config)}`, ...files })) {
      await mkdir(dirname(join(rootDir, name)), { recursive: true })
      await writeFile(join(rootDir, name), contents)
    }
    const nuxt = await loadNuxt({ cwd: rootDir })
    onTestFinished(() => nuxt.close())
    nuxt.apps.default = createApp(nuxt)
    await generateApp(nuxt, nuxt.apps.default, { filter: template => template.filename === 'routes.mjs' })
    await nuxt.callHook('build:before')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warn.mockClear()
    const printed = (code: string) => warn.mock.calls.map(([message]) => String(message)).filter(message => message.includes(code))
    const compile = (source: string, { compilerOptions = nuxt.options.vite.vue!.template!.compilerOptions!, filename = join(rootDir, 'app/pages/index.vue') }: { compilerOptions?: CompilerOptions, filename?: string } = {}) => {
      const { descriptor } = parse(source, { filename })
      compileTemplate({ id: 'test', filename, source: descriptor.template!.content, ast: descriptor.template!.ast, compilerOptions })
    }
    return { nuxt, rootDir, compile, printed }
  }

  const pages = {
    'app/pages/index.vue': '<template><div /></template>',
    'app/pages/users/[id].vue': '<template><div /></template>',
    'app/components/ServerCard.server.vue': '<template><div /></template>',
  }

  it('checks templates against the pages, route rules and server components of the app', async () => {
    const { compile, printed } = await loadApp(pages, { routeRules: { '/old/**': { redirect: '/' } } })

    compile('<template><NuxtLink to="/users/1" /><NuxtLink to="/old/page" /></template>')
    expect(printed('NUXT_B4025')).toStrictEqual([])
    compile('<template><NuxtLink to="/missing" /></template>')
    expect(printed('NUXT_B4025')).toStrictEqual([expect.stringContaining('`<NuxtLink to="/missing">` in `app/pages/index.vue`')])
    expect(printed('NUXT_B4025')[0]).toContain('sources: app/pages/index.vue:1:21')
    compile('<template><ServerCard :format="() => 1" /></template>')
    expect(printed('NUXT_B3015')).toStrictEqual([expect.stringContaining('sources: app/pages/index.vue:1:23')])
  })

  it('registers on the vite and webpack template compilers without changing `vue.compilerOptions`', async () => {
    const { nuxt, compile, printed } = await loadApp(pages, { experimental: { compilerComponentResolution: false } })

    expect(nuxt.options.vite.vue!.template!.compilerOptions!.nodeTransforms).toHaveLength(1)
    expect(nuxt.options.webpack.loaders.vue.compilerOptions!.nodeTransforms).toHaveLength(1)
    expect(nuxt.options.vue.compilerOptions.nodeTransforms).toBeUndefined()

    compile('<template><NuxtLink to="/missing" /></template>', { compilerOptions: nuxt.options.webpack.loaders.vue.compilerOptions })
    expect(printed('NUXT_B4025')).toHaveLength(1)
  })

  it('skips files outside the layers of the app', async () => {
    const { rootDir, compile, printed } = await loadApp(pages)
    compile('<template><NuxtLink to="/missing" /></template>', { filename: join(rootDir, 'node_modules/some-module/runtime/Link.vue') })
    compile('<template><NuxtLink to="/missing" /></template>', { filename: join(repoRoot, 'packages/nuxt/src/app/components/error-404.vue') })
    expect(printed('NUXT_B4025')).toStrictEqual([])
  })

  it('skips the route check when `router.options` may modify routes', async () => {
    const { compile, printed } = await loadApp({ ...pages, 'app/router.options.ts': 'export default { routes: routes => routes }' })
    compile('<template><NuxtLink to="/missing" /></template>')
    expect(printed('NUXT_B4025')).toStrictEqual([])
  })

  it('can be disabled', async () => {
    const { nuxt } = await loadApp(pages, { experimental: { templateDiagnostics: false, compilerComponentResolution: false } })
    expect(nuxt.options.vite.vue!.template!.compilerOptions!.nodeTransforms).toBeUndefined()
    expect(nuxt.options.webpack.loaders.vue.compilerOptions!.nodeTransforms).toBeUndefined()
  })
})
