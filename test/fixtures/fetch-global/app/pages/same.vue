<script setup lang="ts">
const same = ref(false)

onMounted(() => {
  same.value = (window as unknown as { $fetch: unknown }).$fetch === $fetch
})
</script>

<template>
  <div id="same">
    {{ same }}
  </div>
</template>
