<script setup lang="ts">
import '~/assets/scripted.css'
</script>

<template>
  <div>
    <h1 class="scripted-imported-css">
      Scripted index
    </h1>
    <SharedWidget />
    <NuxtLink
      id="link-no-scripts"
      to="/no-scripts"
    >
      No scripts
    </NuxtLink>
    <NuxtLink
      id="link-aliased"
      to="/aliased"
    >
      Aliased (noScripts)
    </NuxtLink>
    <NuxtLink
      id="link-aliased-alt"
      to="/aliased-alt"
    >
      Aliased alt (scripted)
    </NuxtLink>
    <NuxtLink
      id="link-product"
      to="/products/123"
    >
      Product 123
    </NuxtLink>
  </div>
</template>

<style scoped>
h1 {
  color: rgb(20, 21, 22);
}
</style>
