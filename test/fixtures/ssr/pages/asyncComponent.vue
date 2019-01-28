<template>
  <div>
    <AsyncTest />
  </div>
</template>

<script>
const AsyncTest = () => import('@/components/test.vue').then(m => m.default || m)

export default {
  components: {
    AsyncTest
  }
}
</script>
