<script setup lang="ts">
const route = useRoute()
true satisfies IsEqual<typeof route.name, 'named-view' | 'named-view-child'>
true satisfies IsEqual<typeof route.params, Record<never, never>>
</script>

<template>
  <div>
    <template v-if="false">
      {{ (true satisfies IsEqual<typeof $route.name, 'named-view' | 'named-view-child'>) }}
      {{ (true satisfies IsEqual<typeof $route.params, Record<never, never>>) }}
    </template>

    <NuxtPage />
    <aside>
      <NuxtPage name="sidebar" />
    </aside>
  </div>
</template>
