<template>
  <div>
    <MyLazyComponent />
    <SharedVendor />
  </div>
</template>

<script>
export default {
  components: {
    MyLazyComponent: () => import('~/components/lazy.vue')
  }
}
</script>
