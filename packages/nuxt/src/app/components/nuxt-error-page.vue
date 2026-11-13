<template>
  <ErrorTemplate v-bind="{ status, statusText, description, stack }" />
</template>

<script setup>
import { escapeHtml } from '@vue/shared'

const props = defineProps({
  error: Object,
})

// Deliberately prevent reactive update when error is cleared
const _error = props.error

// TODO: extract to a separate utility
const stacktrace = import.meta.dev && _error.stack
  ? _error.stack
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
          line.includes('new Promise'),
        }
      }).map(i => `<span class="stack${i.internal ? ' internal' : ''}">${escapeHtml(i.text)}</span>`).join('\n')
  : ''

// Error page props
const status = Number(_error.status || 500)
const is404 = status === 404

const statusText = _error.statusText ?? (is404 ? 'Page Not Found' : 'Internal Server Error')
const description = _error.message || _error.toString()
const stack = import.meta.dev && !is404 ? _error.description || `<pre>${stacktrace}</pre>` : undefined

const ErrorTemplate = (is404 ? await import('./error-404.vue') : await import('./error-500.vue')).default
</script>
