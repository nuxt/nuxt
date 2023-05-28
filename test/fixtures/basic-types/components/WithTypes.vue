<script setup lang="ts">
defineProps({
  aProp: Number
})
defineSlots<{
  fallback: { id: string }
}>()
defineExpose<{
  _exposedValue: boolean
}>()

const _exposedValue = 42

const emit = defineEmits<{
  'some-event': [id: string]
}>()
emit('some-event', '42')
// @ts-expect-error an invalid argument
emit('some-event', 42)
// @ts-expect-error an unknown event
emit('unknown-event', 42)
</script>

<template>
  <div>
    <!--  -->
  </div>
</template>
