<script setup>
const middlewareLayout = useState('middleware-layout')

definePageMeta({
  middleware: ['sets-layout', 'check-layout'],
})
</script>

<template>
  <div>
    <div>with-dynamic-layout.vue</div>
    <div>middleware layout: {{ middlewareLayout }}</div>
  </div>
</template>
