<template>
  <div>
    <NuxtLink to="/random/a">
      Random (A)
    </NuxtLink>
    <NuxtLink to="/random/b">
      Random (B)
    </NuxtLink>
    <NuxtLink to="/random/c">
      Random (C)
    </NuxtLink>
    <br>

    Random: {{ random }}

    Random: (global) {{ globalRandom }}

    Random page: <b>{{ route.params.id }}</b><br>

    Here are some random numbers for you:

    <ul>
      <li v-for="n in randomNumbers" :key="n">
        {{ n }}
      </li>
    </ul>
    <button @click="() => refresh()">
      Give me another set
    </button>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const pageKey = 'rand_' + route.params.id

const { data: randomNumbers, refresh } = await useFetch('/api/random', { key: pageKey as string })

const random = useRandomState(100, pageKey)
const globalRandom = useRandomState(100)

// TODO: NuxtLink should do this automatically on observed
if (process.client) {
  preloadPayload('/random/c')
}
</script>
