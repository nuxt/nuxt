<template>
  <div>{{ foo }}</div>
</template>

<script>
export default defineNuxtComponent({
  asyncData () {
    return {
      foo: 'foo'
    }
  }
})
</script>
