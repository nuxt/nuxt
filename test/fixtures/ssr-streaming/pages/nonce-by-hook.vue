<template>
  <div
    class="nonce-probe"
    data-testid="title"
  >
    Nonce Page
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Nonce by Hook Page' })
</script>

<style>
.nonce-probe {
  color: rgb(1, 2, 3);
}
</style>
