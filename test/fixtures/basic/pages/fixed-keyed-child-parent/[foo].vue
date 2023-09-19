<template>
  <div :id="`page-${route.params.foo}`">
    [fixed-keyed-child-parent/{{ route.params.foo }}]
    <NuxtLink to="../fixed-keyed-child-parent/1">
      To another
    </NuxtLink>
  </div>
</template>

<script setup>
// eslint-disable-next-line no-console
process.client && console.log('Running Child Setup')
const route = useRoute()

definePageMeta({
  key: 'keyed'
})
</script>
