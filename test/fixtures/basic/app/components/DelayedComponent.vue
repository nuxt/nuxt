<template>
  <div>
    This {{ mounted ? 'is' : 'is not' }} mounted.
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)
onMounted(() => { mounted.value = true })

const props = defineProps<{ logHydration?: true }>()

if (props.logHydration) {
  console.log('hydrated')
}
</script>
