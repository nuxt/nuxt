<script setup lang="ts">
const props = defineProps<{ error: unknown }>()

const error = unref(props.error) as { status?: number, statusText?: string, message?: string, url?: string, unhandled?: boolean }

if (error.url?.includes('redirect-from-error-page')) {
  await navigateTo('/', { redirectCode: 302 })
}
</script>

<template>
  <div id="error-page">
    <h1>{{ error.status }}</h1>
    <p id="error-status-text">
      {{ error.statusText }}
    </p>
    <p id="error-message">
      {{ error.message }}
    </p>
    <p id="error-url">
      {{ error.url }}
    </p>
    <p id="error-unhandled">
      {{ String(error.unhandled) }}
    </p>
  </div>
</template>
