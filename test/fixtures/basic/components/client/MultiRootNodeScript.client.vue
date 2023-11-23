<template>
  <div
    v-bind="$attrs"
    class="multi-root-node-script-count"
  >
    {{ count }}
  </div>
  <button
    class="multi-root-node-script-button"
    @click="add"
  >
    add 1 to count
  </button>
</template>

<script>
export default defineNuxtComponent({
  setup () {
    const count = ref(0)

    const add = () => count.value++
    return { count, add }
  }
})
</script>
