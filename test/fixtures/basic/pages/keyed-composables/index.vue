<script setup lang="ts">
import { useCustomKeyedComposable } from '~/other-composables-folder/custom-keyed-composable'

const useLocalState = () => useState(() => {
  if (import.meta.client) {
    console.error('running usestate')
  }
  return { foo: Math.random() }
})
const useStateTest1 = useLocalState()
const useStateTest2 = useLocalState()

const useLocalAsyncData = () => useAsyncData(() => {
  if (import.meta.client) {
    console.error('running asyncdata')
  }
  return Promise.resolve({ foo: Math.random() })
}, { transform: data => data.foo })
const { data: useAsyncDataTest1 } = await useLocalAsyncData()
const { data: useAsyncDataTest2 } = await useLocalAsyncData()

const useLocalLazyAsyncData = () => useLazyAsyncData(() => {
  if (import.meta.client) {
    console.error('running asyncdata')
  }
  return Promise.resolve({ foo: Math.random() })
}, { transform: data => data.foo })
const { data: useLazyAsyncDataTest1 } = await useLocalLazyAsyncData()
const { data: useLazyAsyncDataTest2 } = await useLocalLazyAsyncData()

const useLocalFetch = () => useFetch('/api/counter', {
  transform: (data) => {
    if (import.meta.client) {
      console.error('running client-side transform')
    }
    return data.count
  }
})
const { data: useFetchTest1 } = await useLocalFetch()
const { data: useFetchTest2 } = await useLocalFetch()

const useLocalLazyFetch = () => useLazyFetch(() => '/api/counter')
const { data: useLazyFetchTest1 } = await useLocalLazyFetch()
const { data: useLazyFetchTest2 } = await useLocalLazyFetch()

const useLocalCustomKeyedComposable = () => useCustomKeyedComposable()
const useMyAsyncDataTest1 = useLocalCustomKeyedComposable()
const useMyAsyncDataTest2 = useLocalCustomKeyedComposable()
</script>

<template>
  <div>
    {{ useStateTest1 === useStateTest2 }}
    {{ useAsyncDataTest1 === useAsyncDataTest2 }}
    {{ useLazyAsyncDataTest1 === useLazyAsyncDataTest2 }}
    {{ useFetchTest1 === useFetchTest2 }}
    {{ useLazyFetchTest1 === useLazyFetchTest2 }}
    {{ !!useMyAsyncDataTest1 && useMyAsyncDataTest1 === useMyAsyncDataTest2 }}
  </div>
</template>

<style scoped>
body {
  background-color: #000;
  color: #fff;
}
</style>
