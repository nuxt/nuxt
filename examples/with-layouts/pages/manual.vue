<template>
  <div>
    Manual control
    <NuxtLayout :name="layout">
      Default slot
      <button @click="layout ? layout = null : layout = 'custom'">
        Switch layout
      </button>

      <template #header>
        Header slot
      </template>
    </NuxtLayout>
    <NuxtLink to="/">
      Back to home
    </NuxtLink>
  </div>
</template>

<script>
definePageMeta({
  layout: false
})
export default {
  data: () => ({
    layout: 'custom'
  })
}
</script>
