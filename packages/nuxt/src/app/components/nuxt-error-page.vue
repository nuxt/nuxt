<template>
  <ErrorTemplate v-bind="{ statusCode, statusMessage, description, stack }" />
</template>

<script setup>
import { defineAsyncComponent } from 'vue'

const props = defineProps({
  error: Object
})

// Deliberately prevent reactive update when error is cleared
// eslint-disable-next-line vue/no-setup-props-destructure
const _error = props.error

// TODO: extract to a separate utility
const stacktrace = (_error.stack || '')
  .split('\n')
  .splice(1)
  .map((line) => {
    const text = line
      .replace('webpack:/', '')
      .replace('.vue', '.js') // TODO: Support sourcemap
      .trim()
    return {
      text,
      internal: (line.includes('node_modules') && !line.includes('.cache')) ||
        line.includes('internal') ||
        line.includes('new Promise')
    }
  }).map(i => `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`).join('\n')

// Error page props
const statusCode = Number(_error.statusCode || 500)
const is404 = statusCode === 404

const statusMessage = _error.statusMessage ?? (is404 ? 'Page Not Found' : 'Internal Server Error')
const description = _error.message || _error.toString()
const stack = import.meta.dev && !is404 ? _error.description || `<pre>${stacktrace}</pre>` : undefined

// TODO: Investigate side-effect issue with imports
const _Error404 = defineAsyncComponent(() => import('@nuxt/ui-templates/templates/error-404.vue').then(r => r.default || r))
const _Error = import.meta.dev
  ? defineAsyncComponent(() => import('@nuxt/ui-templates/templates/error-dev.vue').then(r => r.default || r))
  : defineAsyncComponent(() => import('@nuxt/ui-templates/templates/error-500.vue').then(r => r.default || r))

const ErrorTemplate = is404 ? _Error404 : _Error
</script>
