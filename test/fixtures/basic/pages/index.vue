<template>
  <div>
    <Head>
      <Title>Basic fixture</Title>
    </Head>
    <h1>Hello Nuxt 3!</h1>
    <div>RuntimeConfig | testConfig: {{ config.testConfig }}</div>
    <div>Composable | foo: {{ foo }}</div>
    <div>Composable | bar: {{ bar }}</div>
    <div>Composable | template: {{ templateAutoImport }}</div>
    <div>Path: {{ $route.fullPath }}</div>
    <NuxtLink to="/">
      Link
    </NuxtLink>
    <SugarCounter :count="12" />
    <CustomComponent />
    <component :is="`test${'-'.toString()}global`" />
    <component :is="`with${'-'.toString()}suffix`" />
  </div>
</template>

<script setup>
import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()

// reset title template example
useHead({
  titleTemplate: null
})

const foo = useFoo()
const bar = useBar()
</script>
