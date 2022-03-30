<template>
  <div>
    You've landed on a page that wasn't in the menu!
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'named-test'
})
</script>
