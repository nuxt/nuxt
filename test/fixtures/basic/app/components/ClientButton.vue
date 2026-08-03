<script setup lang="ts">
const liked = ref(false)
</script>

<template>
  <button
    class="client-button"
    @click="liked = !liked"
  >
    {{ liked ? 'Liked' : 'Like' }}
  </button>
</template>
