<script setup>
const page = ref(0)
const nuxt = useNuxtApp()
const { data, refresh } = await useFetch('https://icanhazdadjoke.com/', {
  query: { page }, // "fed" into watch array for asyncData under the hood
  getCachedData: (key) => {
    return nuxt.payload.data[key] || nuxt.static.data[key]
  },
  headers: {
    Accept: 'application/json',
  },
})
</script>

<template>
  <div>
    <button @click="refresh()">
      New Joke (refresh, default)
    </button>
    <button @click="refresh({ force: true })">
      New Joke (refresh, force)
    </button>
    <button @click="page++">
      New Joke (update query value + 1)
    </button>
    <button @click="page--">
      New Joke (update query value - 1)
    </button>
    {{ data.joke }}
  </div>
</template>
