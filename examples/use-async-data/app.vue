<script setup>
const { data, refresh, pending } = await useAsyncData('/api/hello', () => $fetch('/api/hello'))
</script>

<template>
  <NuxtExampleLayout example="use-async-data" show-tips="true">
    <div>{{ data }}</div>
    <div>
      <NButton :disabled="pending" @click="refresh">
        Refresh Data
      </NButton>
    </div>
    <template #tips>
      <div>
        Nuxt will automatically read files in the
        <a href="https://v3.nuxtjs.org/docs/directory-structure/server#api-routes" target="_blank">
          <code>~/server/api</code> directory
        </a>
        to create API endpoints. Learn more about
        <a href="https://v3.nuxtjs.org/docs/usage/data-fetching" target="_blank">data fetching</a>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
