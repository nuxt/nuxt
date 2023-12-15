<script>
export default defineComponent({
  async setup () {
    await nextTick()
    useRuntimeConfig()
  }
})
</script>

<template>
  <div>
    should not error out when using automatic `setup` async transform
  </div>
</template>
