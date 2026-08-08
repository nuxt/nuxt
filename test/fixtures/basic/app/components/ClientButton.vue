<script setup lang="ts">
const liked = ref(false)
const hydrated = ref(false)

onMounted(() => { hydrated.value = true })
</script>

<template>
  <button
    class="client-button"
    :data-hydrated="hydrated"
    @click="liked = !liked"
  >
    {{ liked ? 'Liked' : 'Like' }}
  </button>
</template>
