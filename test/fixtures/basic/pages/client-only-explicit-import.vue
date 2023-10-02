<template>
  <div>
    <ClientOnlyScript class="client-only-script" foo="bar" />
    <LazyClientOnlySetupScript class="lazy-client-only-script-setup" foo="hello" />
  </div>
</template>

<script setup lang="ts">
import { ClientOnlyScript, LazyClientOnlySetupScript } from '#components'
</script>
