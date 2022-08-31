<script setup lang="ts">
const props = defineProps<{
  count: number,
}>()
const doubled = $computed(() => props.count * 2)
</script>

<template>
  <div class="pb2">
    Count <b>{{ count }}</b><br>
    Doubled <b>{{ doubled }}</b>
  </div>
</template>
