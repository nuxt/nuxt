<script lang="ts" setup>
const route = useRoute('/users/[id]')
</script>

<template>
  <p>
    user {{ route.params.id }}
  </p>
</template>
