<template>
  <div>Hello Vue {{ version }}!</div>
</template>

<script>
import { defineComponent, ref } from '#app'

export default defineComponent({
  setup () {
    return {
      version: ref('2')
    }
  }
})
</script>
