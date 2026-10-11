<!-- `lang="ts"` splits the script into its own request, so the imported CSS and the
     `<style>` block below are extracted in separate passes -->
<script setup lang="ts">
import '~/assets/server-only.css'

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
