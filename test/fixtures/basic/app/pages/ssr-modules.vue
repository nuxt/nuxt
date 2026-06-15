<script setup lang="ts">
const modules = useNuxtApp()?.ssrContext?.modules

const modulesState = useState<string[]>('ssr-modules', () => modules ? Array.from(modules) : [])
const modulesJson = computed(() => JSON.stringify(modulesState.value))
</script>

<template>
  <div
    id="ssr-modules"
    :data-modules="modulesJson"
  >
    SSR modules count: {{ modulesState.length }}
  </div>
</template>
