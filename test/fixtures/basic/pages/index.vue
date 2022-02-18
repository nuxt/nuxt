<template>
  <div>
    <Head>
      <Title>Basic fixture</Title>
    </Head>
    <h1>Hello Nuxt 3!</h1>
    <div>Config: {{ $config.testConfig }}</div>
    <CustomComponent />
  </div>
</template>

<script setup>
const $config = useRuntimeConfig()
</script>
