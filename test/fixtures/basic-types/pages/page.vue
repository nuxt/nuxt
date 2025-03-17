<script setup>
// @ts-check
let routeName = /** @satisfies {'page'} */ (useRoute().name)
// @ts-expect-error wrong route name
routeName = /** @satisfies {'not-page'} */ (useRoute().name)
</script>

<template>
  <div>
    {{ /** @satisfies {'page'} */ ($route.name) }}
    <!-- @vue-expect-error wrong route name -->
    {{ /** @satisfies {'not-page'} */ ($route.name) }}
  </div>
</template>
