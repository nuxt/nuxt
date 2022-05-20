<script setup>
const counter = useState('counter', () => Math.round(Math.random() * 1000))
const sameCounter = useState('counter');
</script>

<template>
  <NuxtExampleLayout example="composables/use-state">
    <div>Counter: {{ counter }}</div>
    <div>Same Counter: {{ sameCounter }}</div>
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
