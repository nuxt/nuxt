<script setup lang="ts">
const props = defineProps<{ start: number }>()
const count = ref(props.start)
onMounted(() => {
  const w = window as any
  w.__benchMounted = (w.__benchMounted || 0) + 1
  w.__benchLastMountAt = performance.now()
})
</script>

<template>
  <div class="counter">
    counter {{ count }}
    <button @click="count++">
      inc
    </button>
  </div>
</template>
