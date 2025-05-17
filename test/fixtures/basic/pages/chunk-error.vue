<script setup lang="ts">
const someValue = useState('val', () => 1)
</script>

<template>
  <div>
    Chunk error page
    <hr>
    State: {{ someValue }}
  </div>
</template>
