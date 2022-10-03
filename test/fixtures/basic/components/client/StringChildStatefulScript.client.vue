<script lang="ts">
export default defineNuxtComponent({
  setup (_p, ctx) {
    const state = ref(0)

    const add = () => state.value++

    ctx.expose({ add, state })
    return {
      state
    }
  }
})
</script>

<template>
  <div>Hi i should be rendered {{ state }}</div>
</template>
