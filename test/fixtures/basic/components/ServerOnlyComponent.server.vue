<script setup>
prerenderRoutes(['/some/url/from/server-only/component'])
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
