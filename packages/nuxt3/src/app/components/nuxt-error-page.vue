<template>
  <ErrorTemplate v-bind="{ statusCode, statusMessage, description, stack }" />
</template>

<script setup lang="ts">
import Error404 from '@nuxt/ui-templates/templates/error-404.vue'
import Error500 from '@nuxt/ui-templates/templates/error-500.vue'
import ErrorDev from '@nuxt/ui-templates/templates/error-dev.vue'

const props = defineProps({
  error: Object
})

const error = props.error

// TODO: extract to a separate utility
const stacktrace = (error.stack || '')
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
const statusCode = String(error.statusCode || 500)
const is404 = statusCode === '404'

const statusMessage = error.statusMessage ?? is404 ? 'Page Not Found' : 'Internal Server Error'
const description = error.message || error.toString()
const stack = process.dev && !is404 ? error.description || `<pre>${stacktrace}</pre>` : undefined

const ErrorTemplate = is404 ? Error404 : process.dev ? ErrorDev : Error500
</script>
