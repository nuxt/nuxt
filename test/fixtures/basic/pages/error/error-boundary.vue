<template>
  <div>
    <NuxtErrorBoundary>
      <template #default>
        <MyBrokenComponent />
      </template>
      <template #error>
        <p>This is the error rendering</p>
      </template>
    </NuxtErrorBoundary>
  </div>
</template>

<script setup lang="ts">
const MyBrokenComponent = defineComponent({
  setup () {
    onMounted(() => {
      throw new Error('This is broken')
    })

    return () => h('div', 'This is a broken component')
  },
})
</script>
