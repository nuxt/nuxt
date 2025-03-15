<script setup lang="ts">
defineProps({
  aProp: Number,
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
// eslint-disable-next-line vue/require-explicit-emits
emit('unknown-event', 42)

useRoute().name satisfies keyof import('vue-router/auto-routes').RouteNamedMap
</script>

<template>
  <div>
    {{ $route.name satisfies keyof import('vue-router/auto-routes').RouteNamedMap }}
  </div>
</template>
