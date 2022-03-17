<script setup>
const count = ref(1)
const { data } = await useFetch(() => `/api/hello/${count.value}`, { params: { token: 123 } })
</script>

<template>
  <NuxtExampleLayout example="use-fetch" :show-tips="true">
    <div>
      Fetch result:
      <pre class="text-left"><code>{{ data }}</code></pre>
      <NButton @click="count++">
        +
      </NButton>
    </div>
    <template #tips>
      <div>
        Nuxt will automatically read in files in the
        <a href="https://v3.nuxtjs.org/docs/directory-structure/server#api-routes" target="_blank">
          <code>~/server/api</code> directory
        </a>
        to create API endpoints. Learn more about
        <a href="https://v3.nuxtjs.org/docs/usage/data-fetching" target="_blank">data fetching</a>.
      </div>
    </template>
  </NuxtExampleLayout>
</template>
