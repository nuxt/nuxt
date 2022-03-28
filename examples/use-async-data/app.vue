<script setup>
const showMountain = ref(false)

const refreshing = ref(false)
const refreshAll = async () => {
  refreshing.value = true
  try {
    await refreshNuxtData()
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <NuxtExampleLayout example="use-async-data" show-tips>
    <div>
      <div class="flex justify-center gap-2">
        <NButton @click="showMountain = !showMountain">
          {{ showMountain ? 'Hide' : 'Show' }} Mountain
        </NButton>
        <NButton :disabled="refreshing" @click="refreshAll">
          Refetch All Data
        </NButton>
      </div>

      <div class="flex justify-center gap-2">
        <CounterExample />
      </div>
      <div class="flex justify-center gap-2">
        <MountainExample v-if="showMountain" />
      </div>
    </div>
    <template #tips>
      <div>
        <p>
          This example shows how to use <code>useAsyncData</code> to fetch data from an API endpoint.
        </p>
        <p>
          Nuxt will automatically read files in the
          <a href="https://v3.nuxtjs.org/docs/directory-structure/server#api-routes" target="_blank">
            <code>~/server/api</code> directory
          </a>
          to create API endpoints. Learn more about
          <a href="https://v3.nuxtjs.org/docs/usage/data-fetching" target="_blank">data fetching</a>
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
