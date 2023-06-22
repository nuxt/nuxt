<script setup>
const { isPreview } = usePreviewMode({ controls: true })

const { data } = await useAsyncData(async () => {
  await new Promise((resolve) => setTimeout(resolve, 200))

  const fetchedOnClient = process.client

  console.log(fetchedOnClient)
  
  return { fetchedOnClient }
})
</script>

<template>
  <div>
    <NuxtLink id="use-fetch-check" href="/preview/with-use-fetch">check useFetch</NuxtLink>
    
    <p id="fetched-on-client" v-if="data && data.fetchedOnClient">fetched on client</p>
    
    <p id="preview-mode" v-if="isPreview">preview mode enabled</p>
  </div>
</template>