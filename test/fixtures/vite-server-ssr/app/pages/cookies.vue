<script setup lang="ts">
const visits = useCookie<number>('visits', { default: () => 0 })
visits.value++
useCookie('session').value = null
const theme = useCookie('theme', { readonly: true })
</script>

<template>
  <p id="cookies">
    {{ visits }} {{ theme }}
  </p>
</template>
