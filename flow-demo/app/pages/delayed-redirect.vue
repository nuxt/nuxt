<script setup lang="ts">
const showMessage = ref(true)

onMounted(() => {
  setTimeout(() => {
    showMessage.value = false
    navigateTo('/')
  }, 2000)
})
</script>

<template>
  <div>
    <h1>Logging out...</h1>
    <p v-if="showMessage">You will be redirected to the home page in 2 seconds.</p>
  </div>
</template>
