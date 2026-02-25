<script setup lang="ts">
const props = defineProps<{ foo: string }>()
const count = ref(0)
const add = () => count.value++

defineExpose({ add })
</script>

<template>
  <div class="bg-red">
    <div>client only script setup component {{ props.foo }}</div>
    <button @click="add">
      {{ count }}
    </button>

    <slot name="test" />
  </div>
</template>

<style scoped>
.bg-red{
  background-color: rgb(255, 0, 0);
}
</style>
