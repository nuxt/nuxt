<script setup>
import '~/assets/shared.css'
</script>

<template>
  <main class="shared-box">
    not-inlined
    <SharedBox />
  </main>
</template>

<style>
.page-not-inlined {
  --inline-predicate-page-not-inlined-token: not-inlined;
}
</style>
