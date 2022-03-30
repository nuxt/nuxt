<script setup>
const count = ref(1)
const { data } = await useFetch(() => `/api/hello/${count.value}`, { params: { token: 123 } })
</script>

<template>
  <NuxtExampleLayout example="use-fetch">
    <div>
      Fetch result:
      <pre class="text-left"><code>{{ data }}</code></pre>
      <NButton @click="count++">
        +
      </NButton>
    </div>
  </NuxtExampleLayout>
</template>
