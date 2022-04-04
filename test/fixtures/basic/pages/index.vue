<template>
  <div>
    <Head>
      <Title>Basic fixture</Title>
    </Head>
    <h1>Hello Nuxt 3!</h1>
    <div>RuntimeConfig | testConfig: {{ config.testConfig }}</div>
    <div>Composable | foo: {{ foo }}</div>
    <div>Composable | bar: {{ bar }}</div>
    <NuxtLink to="/">
      Link
    </NuxtLink>
    <SugarCounter :count="12" />
    <CustomComponent />
  </div>
</template>

<script setup>
const config = useRuntimeConfig()

const foo = useFoo()
const bar = useBar()
</script>
