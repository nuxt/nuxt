<script setup>
import '~/assets/shared.css'
</script>

<template>
  <main class="shared-box">
    inlined
    <SharedBox />
  </main>
</template>

<style>
.page-inlined {
  --inline-predicate-page-inlined-token: inlined;
}
</style>
