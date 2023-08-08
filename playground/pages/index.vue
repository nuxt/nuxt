<script setup>
const err = new Error('yikes!')
err.details = "Something happened!"
err.description = "Custom description."
err.data = 'Unfortunate.'
throw err
</script>

<template>
  <div>Welcome, Human!</div>
</template>