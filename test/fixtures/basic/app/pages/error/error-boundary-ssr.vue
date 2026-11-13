<template>
  <div>
    <p id="outside-boundary">
      Content outside the boundary is still rendered
    </p>

    <NuxtErrorBoundary>
      <BreakInSetup class="ssr-boundary-sync-default" />
      <template #error="{ error, clearError }">
        <div class="ssr-boundary-sync-error">
          <p>sync boundary caught: {{ error.message }}</p>
          <button
            id="clear-sync-error"
            @click="clearError"
          >
            clear
          </button>
        </div>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary>
      <BreakInAsyncSetup class="ssr-boundary-async-default" />
      <template #error="{ error }">
        <p class="ssr-boundary-async-error">
          async boundary caught: {{ error.message }}
        </p>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary>
      <BreakInAsyncSetupWrapper />
      <template #error>
        <p class="ssr-boundary-nested-error">
          nested async boundary caught an error
        </p>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary>
      <ThrowsNuxtError />
      <template #error="{ error }">
        <p class="ssr-boundary-nuxt-error">
          nuxt error caught: {{ (error as any).status }} {{ (error as any).statusText }} {{ JSON.stringify((error as any).data) }}
        </p>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary retry-on-client>
      <BreakInSetup class="ssr-boundary-retry-default" />
      <template #error>
        <p class="ssr-boundary-retry-error">
          retry boundary caught an error
        </p>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary retry-on-client>
      <ThrowsEverywhere />
      <template #error="{ error }">
        <p class="ssr-boundary-retry-fails-error">
          retry-fails boundary caught: {{ error.message }}
        </p>
      </template>
    </NuxtErrorBoundary>

    <NuxtErrorBoundary>
      <Counter
        id="ssr-boundary-counter"
        :multiplier="2"
      />
      <template #error>
        <p class="ssr-boundary-healthy-error">
          this should never render
        </p>
      </template>
    </NuxtErrorBoundary>
  </div>
</template>

<script setup lang="ts">
const ThrowsEverywhere = defineComponent({
  setup () {
    throw new Error(import.meta.server ? 'thrown on server' : 'thrown on client')
  },
})

const ThrowsNuxtError = defineComponent({
  setup () {
    if (import.meta.server) {
      throw createError({ status: 418, statusText: 'I am a teapot', data: { flavour: 'earl grey' } })
    }
    return () => h('p', { class: 'ssr-boundary-nuxt-error-default' }, 'nuxt error component rendered on client')
  },
})
</script>
