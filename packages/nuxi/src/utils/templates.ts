import { upperFirst } from 'scule'

interface TemplateOptions {
  name: string,
  args: Record<string, any>
}

interface Template {
  (options: TemplateOptions): { path: string, contents: string }
}

const httpMethods = ['connect', 'delete', 'get', 'head', 'options', 'post', 'put', 'trace', 'patch']
const api: Template = ({ name, args }) => ({
  path: `server/api/${name}${applySuffix(args, httpMethods, 'method')}.ts`,
  contents: `
export default defineEventHandler((event) => {
  return 'Hello ${name}'
})
`
})

const plugin: Template = ({ name, args }) => ({
  path: `plugins/${name}${applySuffix(args, ['client', 'server'], 'mode')}.ts`,
  contents: `
export default defineNuxtPlugin((nuxtApp) => {})
  `
})

const component: Template = ({ name, args }) => ({
  path: `components/${name}${applySuffix(args, ['client', 'server'], 'mode')}.vue`,
  contents: `
<script lang="ts" setup></script>

<template>
  <div>
    Component: ${name}
  </div>
</template>

<style scoped></style>
`
})

const composable: Template = ({ name }) => {
  const nameWithUsePrefix = name.startsWith('use') ? name : `use${upperFirst(name)}`
  return {
    path: `composables/${name}.ts`,
    contents: `
export const ${nameWithUsePrefix} = () => {
  return ref()
}
  `
  }
}

const middleware: Template = ({ name, args }) => ({
  path: `middleware/${name}${applySuffix(args, ['global'])}.ts`,
  contents: `
export default defineNuxtRouteMiddleware((to, from) => {})
`
})

const layout: Template = ({ name }) => ({
  path: `layouts/${name}.vue`,
  contents: `
<script lang="ts" setup></script>

<template>
  <div>
    Layout: ${name}
    <slot />
  </div>
</template>

<style scoped></style>
`
})

const page: Template = ({ name }) => ({
  path: `pages/${name}.vue`,
  contents: `
<script lang="ts" setup></script>

<template>
  <div>
    Page: foo
  </div>
</template>

<style scoped></style>
`
})

export const templates = {
  api,
  plugin,
  component,
  composable,
  middleware,
  layout,
  page
} as Record<string, Template>

// -- internal utils --

function applySuffix (args: TemplateOptions['args'], suffixes: string[], unwrapFrom?: string): string {
  let suffix = ''
  // --client
  for (const s of suffixes) {
    if (args[s]) {
      suffix += '.' + s
    }
  }
  // --mode=server
  if (unwrapFrom && args[unwrapFrom] && suffixes.includes(args[unwrapFrom])) {
    suffix += '.' + args[unwrapFrom]
  }
  return suffix
}
