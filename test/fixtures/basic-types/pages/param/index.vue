<script setup lang="ts">
definePageMeta({
  name: 'param2',
  alias: ['/param-other'],
})

// TODO: Fix this
useRoute().name satisfies 'param2'
// @ts-expect-error wrong route name
useRoute().name satisfies 'not-param2'

// @ts-expect-error route doesn't have any params
useRoute().params.id satisfies string
</script>

<template>
  <div>
    <!--  -->
  </div>
</template>
