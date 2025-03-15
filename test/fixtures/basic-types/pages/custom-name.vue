<script setup lang="ts">
definePageMeta({
  validate: () => true,
  middleware: [
    function () {},
  ],
  name: 'some-custom-name',
})

useRoute().name satisfies 'some-custom-name'
// @ts-expect-error wrong route name
useRoute().name satisfies 'some-other-name'
</script>

<template>
  <div>
    {{ $route.name satisfies 'some-custom-name' }}
    <!-- @vue-expect-error wrong route name -->
    {{ $route.name satisfies 'some-other-name' }}
  </div>
</template>
