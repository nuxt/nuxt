<template>
  <div>
    <div>immediate-remove-unmounted.vue</div>
    <div id="immediate-data">
      {{ data === null ? "null" : data }}
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
const { data, execute } = await useAsyncData('immediateFalse', () => $fetch('/api/random'), { immediate: false })

if (data.value !== null) {
  throw new Error('Initial data should be null: ' + data.value)
}
</script>
