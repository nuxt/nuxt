<script setup>
prerenderRoutes(['/some/url/from/server-only/component'])
console.log('should not be in client bundle')
</script>

<template>
  <div>
    server-only component
    <ServerOnlyComponentChild />
  </div>
</template>

<style>
:root {
  --server-only: 'server-only';
}
</style>
