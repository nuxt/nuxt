<script setup>
const counter = useState('counter', () => Math.round(Math.random() * 1000))
</script>

<template>
  <NuxtExampleLayout example="composables/use-state">
    <div>Counter: {{ counter }}</div>
    <div>
      <NButton class="font-mono" @click="counter++">
        +
      </NButton>
      <NButton class="font-mono" @click="counter--">
        -
      </NButton>
    </div>
  </NuxtExampleLayout>
</template>
