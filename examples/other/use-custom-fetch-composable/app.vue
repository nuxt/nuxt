
<script setup lang="ts">

const { data } = await useCustomFetch<object>('/beers')

</script>

<template>
  <NuxtExampleLayout example="other/use-custom-fetch-composable">
    <h1 class="text-xl opacity-50">
      Nuxt custom fetch
    </h1>

    <pre class="text-left text-xs">{{ data }}</pre>
  </NuxtExampleLayout>
</template>
