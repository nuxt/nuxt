<script setup lang="ts">
import '~/assets/page.css'
</script>

<template>
  <div>
    <h1 id="no-scripts-page">
      No scripts page
    </h1>
    <NoScriptsOnly />
    <SharedWidget />
    <p class="page-imported-css">
      Imported stylesheet
    </p>
    <p class="no-scripts-unscoped">
      Unscoped block
    </p>
    <NuxtLink
      id="link-home"
      to="/"
    >
      Home
    </NuxtLink>
  </div>
</template>

<style scoped>
#no-scripts-page {
  color: rgb(10, 11, 12);
}
</style>

<style>
.no-scripts-unscoped {
  color: rgb(13, 14, 15);
}
</style>
