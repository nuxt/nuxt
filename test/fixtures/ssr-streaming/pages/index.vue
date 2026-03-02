<template>
  <div>
    <h1 data-testid="title">
      Streaming Home
    </h1>
    <NuxtLink
      to="/async-head"
      data-testid="link-async"
    >Async Head</NuxtLink>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Streaming Home' })
</script>
