<script setup>
const count = ref(1)
const { data } = await useFetch(() => `/api/hello/${count.value}`, { params: { token: 123 } })
</script>

<template>
  <NuxtExampleLayout example="use-fetch" show-tips>
    <div>
      Fetch result:
      <pre class="text-left"><code>{{ data }}</code></pre>
      <NButton @click="count++">
        +
      </NButton>
    </div>
    <template #tips>
      <div>
        <p>
          This example shows how to use <code>useFetch</code> to fetch data from an API endpoint.
        </p>
        <p>
          Nuxt will automatically read in files in the
          <a href="https://v3.nuxtjs.org/docs/directory-structure/server#api-routes" target="_blank">
            <code>~/server/api</code> directory
          </a>
          to create API endpoints. Learn more about
          <a href="https://v3.nuxtjs.org/docs/usage/data-fetching" target="_blank">data fetching</a>.
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
