<template>
  <div>
    <Head>
      <Title>Basic fixture</Title>
    </Head>
    <h1>Hello Nuxt 3!</h1>
    <div>RuntimeConfig: {{ config.testConfig }}</div>
    <div>{{ foo }}</div>
    <div>{{ bar }}</div>
    <CustomComponent />
  </div>
</template>

<script setup>
const config = useRuntimeConfig()

const foo = useFoo()
const bar = useBar()
</script>
