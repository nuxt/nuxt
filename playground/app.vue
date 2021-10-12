<template>
  <div class="app">
    <img src="~/assets/logo.svg" height="40">
    <h1 class="greeting">
      {{ hello }}, <br>Nuxt 3!
    </h1>
  </div>
</template>

<script setup>
const greetings = [
  'Hello',
  'Hi',
  'Salut',
  'こんにちは',
  '你好'
]
const hello = useState('hello')
if (!hello.value) {
  hello.value = greetings[Math.random() * greetings.length | 0]
}
</script>

<style scoped>
.app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  padding: 1rem 1.5rem;
}
.greeting {
  font-size: 4em;
  font-weight: 400;
}
</style>
