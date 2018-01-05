<template>
<div>
    <async-test/>
</div>
</template>

<script>
const AsyncTest = () => import('@/components/test.vue').then((m) => m.default || m)

export default {
  components: {
    AsyncTest
  }
}
</script>