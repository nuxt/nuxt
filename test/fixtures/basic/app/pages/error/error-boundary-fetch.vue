<script setup lang="ts">
const ThrowsFetchError = defineComponent({
  async setup () {
    if (import.meta.server) {
      await $fetch('/api/error-boundary-fetch')
    }
    return () => h('p', { class: 'fetch-error-default' }, 'fetch error default')
  },
})

const ThrowsError = defineComponent({
  setup () {
    if (import.meta.server) {
      throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.3:5432 thrown-secret'), {
        data: { secret: 'thrown-secret-data' },
      })
    }
    return () => h('p', { class: 'thrown-error-default' }, 'thrown error default')
  },
})

const ThrowsFetchErrorWithoutStatus = defineComponent({
  setup () {
    if (import.meta.server) {
      throw Object.assign(new Error('network failure no-status-secret'), { name: 'FetchError' })
    }
    return () => h('p', { class: 'fetch-no-status-default' }, 'fetch no status default')
  },
})
</script>

<template>
  <div>
    <NuxtErrorBoundary>
      <ThrowsFetchError class="fetch-error-default" />
      <template #error="{ error }">
        <div id="fetch-error">
          {{ (error as any).status }} {{ (error as any).data?.reason }}
        </div>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary>
      <ThrowsError class="thrown-error-default" />
      <template #error="{ error }">
        <div id="thrown-error">
          {{ (error as any).status }} {{ (error as any).message }}
        </div>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary>
      <ThrowsFetchErrorWithoutStatus class="fetch-no-status-default" />
      <template #error="{ error }">
        <div id="fetch-no-status-error">
          {{ (error as any).status }} {{ (error as any).message }}
        </div>
      </template>
    </NuxtErrorBoundary>
  </div>
</template>
