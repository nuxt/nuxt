<template>
  <div>
    Hello from extended page !
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'foo'
})
</script>
