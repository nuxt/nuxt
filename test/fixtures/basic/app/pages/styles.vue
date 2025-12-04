<template>
  <div>
    <ClientOnlyScript />
    <FunctionalComponent />
    <ServerOnlyComponent />
    <SharedComponent class="style-from-parent" />
  </div>
</template>

<script setup>
import '~/assets/assets.css'
</script>

<style lang="postcss">
  :root {
    --postcss: 'postcss';
  }
</style>

<style scoped>
  /* Regression test for https://github.com/nuxt/nuxt/issues/26057 */
  /* definePageMeta( */
  div {
    --scoped: 'scoped';
  }

  .style-from-parent {
    --style-from-parent: 'style-from-parent';
  }
</style>
