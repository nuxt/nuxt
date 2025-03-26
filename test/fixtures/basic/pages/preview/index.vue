<script setup>
const { enabled: isPreview } = usePreviewMode()

const { data } = await useAsyncData(async () => {
  await new Promise(resolve => setTimeout(resolve, 200))

  const fetchedOnClient = import.meta.client

  console.log(fetchedOnClient)

  return { fetchedOnClient }
})
</script>

<template>
  <div>
    <NuxtLink
      id="use-fetch-check"
      href="/preview/with-use-fetch"
    >
      check useFetch
    </NuxtLink>

    <p
      v-if="data && data.fetchedOnClient"
      id="fetched-on-client"
    >
      fetched on client
    </p>

    <p
      v-if="isPreview"
      id="preview-mode"
    >
      preview mode enabled
    </p>
  </div>
</template>
