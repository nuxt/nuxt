<script setup>
import SharedCssModule from '../components/shared-css-module.js'
</script>

<template>
  <main class="shared-css-via-js">
    <SharedCssModule />
  </main>
</template>

<style>
.shared-css-via-js {
  --inline-shared-css-via-js-token: shared-css-via-js;
}
</style>
