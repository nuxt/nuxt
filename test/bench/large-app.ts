import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'

const sections = ['account', 'admin', 'blog', 'catalog', 'checkout', 'docs', 'help', 'marketing', 'reports', 'settings']
const componentGroups = ['base', 'forms', 'layout', 'data', 'feedback', 'navigation', 'media', 'overlay', 'commerce', 'content']

function pascal (value: string) {
  return value.replace(/(?:^|[-/])(\w)/g, (_, c: string) => c.toUpperCase())
}

function page (section: string, index: number, componentNames: string[]) {
  const used = componentNames.slice(index % 20, (index % 20) + 4)
  return `<script setup lang="ts">
definePageMeta({ layout: '${index % 3 === 0 ? 'dashboard' : 'default'}', middleware: ['${section}-guard'] })
const route = useRoute()
const { data } = await useAsyncData('${section}-${index}', () => fetch${pascal(section)}Item(String(route.params.id ?? ${index})))
useHead({ title: \`${section} ${index}\` })
const { count } = useCounter${index % 10}()
</script>

<template>
  <div>
    <h1>{{ data?.title }}</h1>
${used.map(name => `    <${name} :count="count" />`).join('\n')}
    <NuxtLink to="/${section}">
      back
    </NuxtLink>
  </div>
</template>
`
}

function component (name: string, index: number) {
  return `<script setup lang="ts">
const props = defineProps<{ count?: number, label?: string }>()
const open = ref(false)
const doubled = computed(() => (props.count ?? 0) * ${index % 7 + 1})
</script>

<template>
  <div class="${name.toLowerCase()}" @click="open = !open">
    <slot>{{ props.label ?? '${name}' }}</slot>
    <span v-if="open">{{ doubled }}</span>
  </div>
</template>
`
}

function composable (index: number) {
  return `export function useCounter${index} (initial = ${index}) {
  const count = useState('counter-${index}', () => initial)
  const increment = () => { count.value++ }
  return { count, increment }
}

export const counter${index}Defaults = { step: ${index}, max: ${index * 10} }

export function formatCounter${index} (value: number) {
  return \`\${value} / \${counter${index}Defaults.max}\`
}
`
}

function sectionUtil (section: string) {
  return `export function fetch${pascal(section)}Item (id: string) {
  return $fetch<{ title: string }>(\`/api/${section}/\${id}\`)
}

export function ${section}Key (id: string) {
  return \`${section}:\${id}\`
}
`
}

export const largeAppDir = fileURLToPath(new URL('../fixtures-temp/bench-large-app', import.meta.url))

/**
 * Write a generated Nuxt app of a few hundred source files (pages, components, composables,
 * plugins, middleware, server routes and a local layer) to `dir`.
 */
export async function createLargeApp (dir = largeAppDir): Promise<string> {
  await rm(dir, { recursive: true, force: true })
  const files: Record<string, string> = {}

  files['package.json'] = JSON.stringify({ name: 'nuxt-bench-large-app', private: true, type: 'module' })
  files['nuxt.config.ts'] = `export default defineNuxtConfig({
  extends: ['./layers/shared'],
  devtools: { enabled: false },
  sourcemap: false,
  compatibilityDate: 'latest',
  typescript: { typeCheck: false },
})
`
  files['app/app.vue'] = '<template>\n  <NuxtLayout>\n    <NuxtPage />\n  </NuxtLayout>\n</template>\n'
  files['app/error.vue'] = '<script setup lang="ts">\ndefineProps<{ error: { statusCode: number } }>()\n</script>\n\n<template>\n  <div>{{ error.statusCode }}</div>\n</template>\n'
  for (const layout of ['default', 'dashboard', 'auth', 'blank']) {
    files[`app/layouts/${layout}.vue`] = `<template>\n  <div class="layout-${layout}">\n    <slot />\n  </div>\n</template>\n`
  }

  const componentNames: string[] = []
  for (const group of componentGroups) {
    for (let i = 0; i < 30; i++) {
      const name = `${pascal(group)}Item${i}`
      componentNames.push(name)
      const suffix = i % 15 === 14 ? '.client' : ''
      files[`app/components/${group}/Item${i}${suffix}.vue`] = component(name, i)
    }
  }

  for (const section of ['home', 'shared', ...sections]) {
    files[`app/middleware/${section}-guard.ts`] = `export default defineNuxtRouteMiddleware((to) => {\n  if (to.query.blocked === '${section}') {\n    return navigateTo('/')\n  }\n})\n`
    files[`app/utils/${section}.ts`] = sectionUtil(section)
    for (let i = 0; i < 8; i++) {
      files[`server/api/${section}/${i === 0 ? '[id]' : `action-${i}`}.get.ts`] = i === 0
        ? `import { defineEventHandler, getRouterParam } from 'nuxt/server'\n\nexport default defineEventHandler(event => ({ title: \`${section} \${getRouterParam(event, 'id')}\` }))\n`
        : `import { defineEventHandler } from 'nuxt/server'\n\nexport default defineEventHandler(() => ({ title: '${section} ${i}' }))\n`
    }
  }

  for (const section of sections) {
    files[`app/pages/${section}/index.vue`] = page(section, 0, componentNames)
    files[`app/pages/${section}/[id].vue`] = page(section, 1, componentNames)
    for (let i = 2; i < 15; i++) {
      files[`app/pages/${section}/${i % 4 === 0 ? `group-${i}/[slug]` : `page-${i}`}.vue`] = page(section, i, componentNames)
    }
  }
  files['app/pages/index.vue'] = page('home', 0, componentNames)

  for (let i = 0; i < 60; i++) {
    files[`app/composables/counter-${i}.ts`] = composable(i)
  }
  for (let i = 0; i < 12; i++) {
    files[`app/plugins/${String(i).padStart(2, '0')}.plugin-${i}.ts`] = `export default defineNuxtPlugin(() => {\n  return { provide: { plugin${i}: () => ${i} } }\n})\n`
  }
  for (let i = 0; i < 10; i++) {
    files[`shared/utils/shared-${i}.ts`] = `export const shared${i} = (value: string) => value.repeat(${i + 1})\n`
  }

  files['layers/shared/nuxt.config.ts'] = 'export default defineNuxtConfig({})\n'
  for (let i = 0; i < 50; i++) {
    files[`layers/shared/app/components/shared/Widget${i}.vue`] = component(`SharedWidget${i}`, i)
  }
  for (let i = 0; i < 20; i++) {
    files[`layers/shared/app/pages/shared/page-${i}.vue`] = page('shared', i, componentNames)
    files[`layers/shared/app/composables/shared-${i}.ts`] = composable(100 + i)
  }

  await Promise.all(Object.entries(files).map(async ([path, contents]) => {
    const file = join(dir, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, contents)
  }))

  return dir
}
