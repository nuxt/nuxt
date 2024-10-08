<script setup>
prerenderRoutes(['/catchall/some/url/from/server-only/component'])
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
