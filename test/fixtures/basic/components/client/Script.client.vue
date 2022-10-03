<script lang="ts">
export default defineNuxtComponent({
  name: 'ClientScript',
  props: {
    foo: {
      type: String
    }
  },
  setup (_p, ctx) {
    const count = ref(0)
    const add = () => count.value++

    ctx.expose({ add })

    return {
      count,
      add
    }
  }
})
</script>

<template>
  <div>
    <div class="client-only-css">
      client only script component {{ foo }}
    </div>
    <button @click="add">
      {{ count }}
    </button>
    <slot name="test" />
  </div>
</template>

<style>
:root {
  --client-only: "client-only";
}
</style>

<style scoped>
.client-only-css {
  color: rgb(50, 50, 50);
}
</style>
