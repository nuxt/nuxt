<script setup lang="ts">
const useLocalState = () => useState(() => ({ foo: Math.random() }))
const useStateTest1 = useLocalState()
const useStateTest2 = useLocalState()

const useLocalAsyncData = () => useAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo })
const { data: useAsyncDataTest1 } = await useLocalAsyncData()
const { data: useAsyncDataTest2 } = await useLocalAsyncData()

const useLocalLazyAsyncData = () => useLazyAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo })
const { data: useLazyAsyncDataTest1 } = await useLocalLazyAsyncData()
const { data: useLazyAsyncDataTest2 } = await useLocalLazyAsyncData()

const useLocalFetch = () => useFetch('/api/counter', { transform: data => data.count })
const { data: useFetchTest1 } = await useLocalFetch()
const { data: useFetchTest2 } = await useLocalFetch()

const useLocalLazyFetch = () => useLazyFetch(() => '/api/counter')
const { data: useLazyFetchTest1 } = await useLocalLazyFetch()
const { data: useLazyFetchTest2 } = await useLocalLazyFetch()
</script>

<template>
  <pre>
    {{ useStateTest1 === useStateTest2 }}
    {{ useAsyncDataTest1 === useAsyncDataTest2 }}
    {{ useLazyAsyncDataTest1 === useLazyAsyncDataTest2 }}
    {{ useFetchTest1 === useFetchTest2 }}
    {{ useLazyFetchTest1 === useLazyFetchTest2 }}
  </pre>
</template>
