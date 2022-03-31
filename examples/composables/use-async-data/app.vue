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
  <NuxtExampleLayout example="composables/use-async-data">
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
  </NuxtExampleLayout>
</template>
