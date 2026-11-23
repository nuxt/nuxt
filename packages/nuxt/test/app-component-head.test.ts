// @vitest-environment node
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { join, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { addTemplate } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { createApp, generateApp } from '../src/core/app.ts'
import { loadNuxt } from '../src/index.ts'
import { createHead } from '@unhead/vue/server'
import { TemplateParamsPlugin } from '@unhead/vue/plugins'
import { useSeoMeta } from '@unhead/vue'
import type { SerializableHead, UseSeoMetaInput } from '@unhead/vue/types'
import { AppComponentHeadPlugin, extractAppComponentHead } from '../src/head/plugins/app-component-head.ts'
import type { AppComponentHeadImports } from '../src/head/plugins/app-component-head.ts'

const headImports: AppComponentHeadImports = {
  imports: new Map([['useHead', 'useHead'], ['useSeoMeta', 'useSeoMeta']]),
  autoImport: true,
}

async function extract (script: string, { attrs = 'setup lang="ts"', id = '/app/app.vue', imports = headImports } = {}) {
  const code = id.endsWith('.vue') ? `<script ${attrs}>\n${script}\n</script>\n\n<template><div /></template>\n` : script
  return (await extractAppComponentHead(code, id, imports)).entries
}

function render (entries: SerializableHead[], after: SerializableHead[] = []) {
  const head = createHead({ disableDefaults: true, plugins: [TemplateParamsPlugin] })
  head.push({ title: 'Config', titleTemplate: '%s - Config' })
  for (const input of [...entries, ...after]) {
    head.push(input)
  }
  return head.render().headTags
}

describe('app component head extraction', () => {
  it('hoists static useHead and useSeoMeta calls in order', async () => {
    expect(await extract(`
      useHead({ htmlAttrs: { lang: 'en' }, link: [{ rel: 'icon', href: \`/favicon.ico\` }], meta: [{ name: 'theme-color', content: '#000' }] })
      useSeoMeta({ titleTemplate: '%s | Site', ogImage: '/og.png', description: 'Description' } as const)
      useHead({ bodyAttrs: { 'data-count': -1, 'data-flag': true, 'data-empty': null } })
    `)).toMatchInlineSnapshot(`
      [
        {
          "htmlAttrs": {
            "lang": "en",
          },
          "link": [
            {
              "href": "/favicon.ico",
              "rel": "icon",
            },
          ],
          "meta": [
            {
              "content": "#000",
              "name": "theme-color",
            },
          ],
        },
        {
          "meta": [
            {
              "content": "/og.png",
              "property": "og:image",
            },
            {
              "content": "Description",
              "name": "description",
            },
          ],
          "titleTemplate": "%s | Site",
        },
        {
          "bodyAttrs": {
            "data-count": -1,
            "data-empty": null,
            "data-flag": true,
          },
        },
      ]
    `)
  })

  it.each([
    ['identifiers', `useHead({ title: siteName })`],
    ['calls', `useHead({ title: getTitle() })`],
    ['spreads', `useHead({ ...base })`],
    ['array spreads', `useHead({ link: [...links] })`],
    ['computed keys', `useHead({ ['title']: 'Site' })`],
    ['getters', `useHead({ get title () { return 'Site' } })`],
    ['methods', `useHead({ titleTemplate (title) { return title } })`],
    ['function values', `useHead({ titleTemplate: title => \`\${title} | Site\` })`],
    ['template literals with expressions', `useHead({ title: \`\${'Site'}\` })`],
    ['regular expressions', `useHead({ title: /site/ })`],
    ['sparse arrays', `useHead({ link: [, { rel: 'icon' }] })`],
    ['prototype keys', `useHead({ __proto__: { title: 'Site' } })`],
    ['non-object input', `useHead('Site')`],
    ['a second argument', `useHead({ title: 'Site' }, { tagPriority: 'low' })`],
    ['no arguments', `useHead()`],
    ['useHeadSafe', `useHeadSafe({ title: 'Site' })`],
    ['useServerHead', `useServerHead({ title: 'Site' })`],
    ['assigned entries', `const entry = useHead({ title: 'Site' })`],
    ['optional calls', `useHead?.({ title: 'Site' })`],
    ['conditional calls', `if (import.meta.server) { useHead({ title: 'Site' }) }`],
    ['calls in callbacks', `onMounted(() => useHead({ title: 'Site' }))`],
  ])('does not hoist %s', async (_, script) => {
    expect(await extract(script)).toEqual([])
  })

  it('only hoists the leading static calls', async () => {
    expect(await extract(`
      useHead({ title: 'First' })
      useHead({ title: () => route.meta.title })
      useHead({ title: 'Second' })
    `)).toEqual([{ title: 'First' }])
  })

  it.each([
    ['a call', `const route = useRoute()`],
    ['a statement-level call', `usePageHead()`],
    ['a property read', `const title = site.title`],
    ['a destructuring', `const { title } = site`],
    ['a destructuring default', `const { entry = useHead({ title: 'Earlier' }) } = {}`],
    ['an array destructuring default', `const [entry = useHead({ title: 'Earlier' })] = []`],
    ['a compiler macro with side effects in its arguments', `defineExpose({ head: useHead({ title: 'Earlier' }) })`],
    ['a compiler macro reading a property in its arguments', `defineExpose({ value: source.value })`],
    ['a compiler macro spreading an object in its arguments', `defineExpose({ ...source })`],
  ])('does not hoist past %s', async (_, statement) => {
    expect(await extract(`${statement}\nuseHead({ title: 'Site' })`)).toEqual([])
  })

  it('skips statements that cannot push head entries', async () => {
    expect(await extract(`
      import { ref } from 'vue'
      type Props = { title?: string }
      interface Emits {}
      const props = withDefaults(defineProps<Props>(), { title: 'Site' })
      defineEmits<Emits>()
      defineOptions({ name: 'App' })
      const site = { name: 'Site' }
      let count
      function getTitle () { return useRoute().meta.title }
      useHead({ title: 'Site' })
    `)).toEqual([{ title: 'Site' }])
  })

  it('resolves explicit imports of the head composables', async () => {
    expect(await extract(`
      import { useHead as head } from '#imports'
      import { useSeoMeta } from '@unhead/vue'
      head({ title: 'Site' })
      useSeoMeta({ description: 'Description' })
    `, { imports: { ...headImports, autoImport: false } })).toEqual([
      { title: 'Site' },
      { meta: [{ name: 'description', content: 'Description' }] },
    ])
  })

  it.each([
    ['imported from elsewhere', `import { useHead } from '~/composables/head'\nuseHead({ title: 'Site' })`],
    ['declared locally', `const useHead = (input: object) => input\nuseHead({ title: 'Site' })`],
    ['declared in a later statement', `useHead({ title: 'Site' })\nfunction useHead (input: object) { return input }`],
    ['imported as a type', `import type { useHead } from '#imports'\nuseHead({ title: 'Site' })`],
  ])('does not hoist calls to a composable %s', async (_, script) => {
    expect(await extract(script)).toEqual([])
  })

  it('does not hoist calls to composables that `#imports` provides from elsewhere', async () => {
    const imports = { imports: new Map([['useHead', 'useRoute']]), autoImport: true }
    expect(await extract(`useHead({ title: 'Site' })`, { imports })).toEqual([])
    expect(await extract(`import { useHead } from '#imports'\nuseHead({ title: 'Site' })`, { imports })).toEqual([])
    expect(await extract(`useHead({ title: 'Site' })`, { imports: { ...headImports, autoImport: false } })).toEqual([])
  })

  it('resolves names declared in a sibling `<script>` block', async () => {
    const code = `<script lang="ts">\nimport { useHead } from '~/composables/head'\n</script>\n<script setup lang="ts">\nuseHead({ title: 'Site' })\n</script>\n`
    expect((await extractAppComponentHead(code, '/app/app.vue', headImports)).entries).toEqual([])
    const imported = `<script lang="ts">\nimport { useHead as head } from '#app'\n</script>\n<script setup lang="ts">\nhead({ title: 'Site' })\n</script>\n`
    expect((await extractAppComponentHead(imported, '/app/app.vue', headImports)).entries).toEqual([{ title: 'Site' }])
  })

  it('reads the script blocks of the component as Vue parses them', async () => {
    const code = `<!-- <script setup>useHead({ title: 'Commented' })</script> -->\n<script setup lang="ts" generic="T extends Record<string, unknown>">\nuseHead({ title: 'Site' })\n</script>\n`
    expect((await extractAppComponentHead(code, '/app/app.vue', headImports)).entries).toEqual([{ title: 'Site' }])
  })

  it('hoists from the setup function of an Options API component', async () => {
    expect(await extract(`
      export default defineComponent({
        setup () {
          useHead({ title: 'Site' })
          useHead({ title: ref('Dynamic') })
        },
      })
    `, { attrs: 'lang="ts"' })).toEqual([{ title: 'Site' }])
    expect(await extract(`
      export default defineComponent({
        setup () {
          useHead({ title: 'Site' })
        },
      })
    `, { id: '/app/app.ts' })).toEqual([{ title: 'Site' }])
  })

  it('does not hoist from module scope of an Options API component', async () => {
    expect(await extract(`useHead({ title: 'Site' })\nexport default {}`, { attrs: '' })).toEqual([])
  })

  it('does not hoist from a setup function that may be replaced', async () => {
    expect(await extract(`export default { setup () { useHead({ title: 'Site' }) }, ...mixin }`, { attrs: '' })).toEqual([])
    expect(await extract(`export default { setup () { useHead({ title: 'Site' }) }, setup () {} }`, { attrs: '' })).toEqual([])
    expect(await extract(`export default wrap({ setup () { useHead({ title: 'Site' }) } })`, { attrs: '' })).toEqual([])
    expect(await extract(`export default defineNuxtComponent({ setup () { useHead({ title: 'Site' }) } })`, { attrs: '' })).toEqual([{ title: 'Site' }])
  })

  it('renders useSeoMeta input the same as the composable', async () => {
    const input: UseSeoMetaInput = {
      title: 'Home',
      titleTemplate: '%s | %siteName',
      description: 'Welcome to %siteName',
      ogTitle: '%s',
      ogImage: { url: '/og.png', width: 1200 },
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      twitterCard: 'summary_large_image',
      robots: { index: true, follow: false },
      themeColor: [{ content: '#fff', media: '(prefers-color-scheme: light)' }],
    }
    const hoisted = await extract(`useSeoMeta(${JSON.stringify(input)})`)
    expect(hoisted).toHaveLength(1)

    const head = createHead({ disableDefaults: true, plugins: [TemplateParamsPlugin] })
    head.push({ title: 'Config', titleTemplate: '%s - Config', templateParams: { siteName: 'Site' } })
    useSeoMeta(input, { head })

    expect(render(hoisted, [{ templateParams: { siteName: 'Site' } }])).toBe(head.render().headTags)
  })

  it('overrides earlier entries and loses to later ones', async () => {
    const hoisted = await extract(`useSeoMeta({ titleTemplate: '%s | Site', description: 'Site' })`)
    expect(render(hoisted)).toMatchInlineSnapshot(`
      "<title>Config | Site</title>
      <meta name="description" content="Site">"
    `)
    expect(render(hoisted, [{ title: 'Page', meta: [{ name: 'description', content: 'Page' }] }])).toMatchInlineSnapshot(`
      "<title>Page | Site</title>
      <meta name="description" content="Page">"
    `)
  })
})

describe('app component head transform', () => {
  let appComponent: string | undefined = '/app/app.vue'
  const plugin = AppComponentHeadPlugin({
    getAppComponent: () => appComponent,
    getImports: () => Promise.resolve(headImports),
  }).raw({}, { framework: 'vite' } as any) as { transform: { handler: (code: string, id: string) => Promise<{ code: string } | undefined> } }

  const code = `<script setup lang="ts">
const a = 1
useHead({ title: 'Site' })
useSeoMeta({ description: 'Site' })
;[a].forEach(() => {})
useHead({ title: () => 'Dynamic' })
</script>

<template><div /></template>
`

  it('removes hoisted calls from the app component', async () => {
    expect((await plugin.transform.handler(code, '/app/app.vue'))?.code).toMatchInlineSnapshot(`
      "<script setup lang="ts">
      const a = 1
      ;
      ;[a].forEach(() => {})
      useHead({ title: () => 'Dynamic' })
      </script>

      <template><div /></template>
      "
    `)
  })

  it('leaves other components and disabled hoisting alone', async () => {
    expect(await plugin.transform.handler(code, '/app/components/app.vue')).toBeUndefined()
    appComponent = undefined
    expect(await plugin.transform.handler(code, '/app/app.vue')).toBeUndefined()
    appComponent = '/app/app.vue'
  })

  it('ignores blocks of the app component that are not scripts', async () => {
    expect(await plugin.transform.handler(`.useHead { color: red }`, '/app/app.vue?vue&type=style&index=0&lang.css')).toBeUndefined()
  })
})

describe('app component head in a nuxt build', async () => {
  const repoRoot = await findWorkspaceDir()
  const sfc = `<script setup lang="ts">\nuseHead({ title: 'Site' })\n</script>\n\n<template><div /></template>\n`

  const rootDirs: string[] = []

  afterAll(async () => {
    await Promise.all(rootDirs.map(dir => rm(dir, { recursive: true, force: true })))
  })

  async function build (setup: (nuxt: Nuxt, rootDir: string) => void | Promise<void>) {
    const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
    rootDirs.push(rootDir)
    await mkdir(rootDir, { recursive: true })
    const nuxt = await loadNuxt({ cwd: rootDir, overrides: { pages: false } })
    await setup(nuxt, rootDir)
    const app = nuxt.apps.default = createApp(nuxt)
    await generateApp(nuxt, app)

    const config = { plugins: [] as any[] }
    await nuxt.callHook('vite:extend', { config } as any)
    const plugin = config.plugins.flat().find(p => p?.name === 'nuxt:head:app-component-head')
    const component = app.mainComponent!
    const transformed = await plugin.transform.handler(sfc, component)
    const appComponentHead = Object.entries(nuxt.vfs).find(([path]) => path.endsWith('/unhead.config.mjs'))![1]
      .match(/appComponentHead = (.*)/)![1]
    await nuxt.close()
    return { appComponentHead: JSON.parse(appComponentHead!), removed: !!transformed }
  }

  it('moves static head out of an app component on disk', async () => {
    expect(await build((_, rootDir) => writeFile(join(rootDir, 'app.vue'), sfc))).toEqual({
      appComponentHead: [{ title: 'Site' }],
      removed: true,
    })
  })

  it('leaves an app component that only exists in the virtual file system alone', async () => {
    expect(await build((nuxt) => {
      const template = addTemplate({ filename: 'virtual-app.vue', getContents: () => sfc })
      nuxt.hook('app:resolve', (app) => { app.mainComponent = template.dst })
    })).toEqual({ appComponentHead: [], removed: false })
  })
})
