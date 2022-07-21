<script setup>
definePageMeta({
  title: "l'equipe"
  // middleware: 'inject-auth'
})
</script>

<template>
  <div>
    <div>no-auth.vue</div>
    <div>auth: {{ $route.meta.auth }}</div>
  </div>
</template>
