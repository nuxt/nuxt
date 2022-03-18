<script setup>
const counter = useState('counter', () => Math.round(Math.random() * 1000))
</script>

<template>
  <NuxtExampleLayout :show-tips="true" example="use-state">
    <div>Counter: {{ counter }}</div>
    <div>
      <NButton class="font-mono" @click="counter++">
        +
      </NButton>
      <NButton class="font-mono" @click="counter--">
        -
      </NButton>
    </div>

    <template #tips>
      <div>
        <NuxtLink to="https://v3.nuxtjs.org/docs/usage/state" target="_blank">
          useState
        </NuxtLink>
        is an SSR-friendly ref replacement.
        Its value will be preserved after server-side rendering
        and shared across all components using a unique key.
      </div>
    </template>
  </NuxtExampleLayout>
</template>
