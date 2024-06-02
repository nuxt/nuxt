<template>
  <div>
    <div>immediate-remove-unmounted.vue</div>
    <div id="immediate-data">
      {{ data === null ? "null" : (data === undefined ? 'undefined' : data) }}
    </div>
    <button
      id="execute-btn"
      @click="execute"
    >
      execute
    </button>
    <NuxtLink
      id="to-index"
      to="/"
    >
      index
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { asyncDataDefaults } from '#build/nuxt.config.mjs'

const { data, execute } = await useAsyncData('immediateFalse', () => $fetch('/api/random'), { immediate: false })

if (data.value !== asyncDataDefaults.errorValue) {
  throw new Error(`Initial data should be ${asyncDataDefaults.errorValue}: ` + data.value)
}
</script>
