<template>
  <div>Hello Vue {{ version }}!</div>
</template>

<script>
export default defineComponent({
  setup () {
    return {
      version: ref('2')
    }
  }
})
</script>
