<script setup lang="ts">
const name = ref<'ThrowingComponent' | 'RouteComponent'>('ThrowingComponent')
const island = ref<{ refresh: () => Promise<void> }>()
</script>

<template>
  <div>
    <div id="island-error">
      <NuxtIsland
        ref="island"
        :name="name"
        :context="{ url: '/island-error' }"
      >
        <template #fallback="{ error }">
          <p id="island-error-fallback">
            Island failed with {{ (error as { status?: number } | undefined)?.status }}
          </p>
        </template>
      </NuxtIsland>
    </div>
    <div id="island-error-no-fallback">
      <NuxtIsland name="ThrowingComponent" />
    </div>
    <button
      id="island-error-recover"
      @click="name = 'RouteComponent'"
    >
      Recover
    </button>
    <button
      id="island-error-break"
      @click="name = 'ThrowingComponent'"
    >
      Break
    </button>
    <button
      id="island-error-refresh"
      @click="island?.refresh()"
    >
      Refresh
    </button>
  </div>
</template>
