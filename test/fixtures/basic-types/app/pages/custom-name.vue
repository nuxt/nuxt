<script setup lang="ts">
definePageMeta({
  validate: () => true,
  middleware: [
    function () {},
  ],
  name: 'some-custom-name',
})

const route = useRoute()
true satisfies IsEqual<typeof route.name, 'some-custom-name'>
true satisfies IsEqual<typeof route.params, Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'some-custom-name'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, Record<never, never>>) }}
    </template>
  </div>
</template>
