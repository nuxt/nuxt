<template>
  <div :id="`page-${route.params.foo}`">
    [keyed-child-parent/{{ route.params.foo }}]
    <NuxtLink to="../keyed-child-parent/1">
      To another
    </NuxtLink>
  </div>
</template>

<script setup>
if (import.meta.client) {
  console.log('Running Child Setup')
}
const route = useRoute()

definePageMeta({
  key: r => 'keyed-' + r.params.foo
})
</script>
