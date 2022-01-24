<template>
  <div>
    Child reloaded: {{ reloads }}
  </div>
</template>

<script setup>
const reloads = useState('static', () => 0)
onMounted(() => { reloads.value++ })
</script>
