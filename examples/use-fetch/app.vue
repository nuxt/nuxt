<script setup>
const { data } = await useFetch('/api/hello', { params: { foo: 'bar' } })
</script>

<template>
  <NuxtExampleLayout example="use-fetch" show-tips="true">
    Server response
    <pre class="text-left"><code>{{ data }}</code></pre>
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
