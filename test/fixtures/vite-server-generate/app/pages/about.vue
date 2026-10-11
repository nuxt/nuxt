<script setup lang="ts">
useHead({ title: 'About' })
const { data } = await useAsyncData('about', () => Promise.resolve('about data'))
</script>

<template>
  <p id="about">
    {{ data }}
  </p>
</template>
