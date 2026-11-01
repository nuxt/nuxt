<script setup lang="ts">
const router = useRouter()
let outcome = 'added'
try {
  // @ts-expect-error `addRoute` is removed from the router type with static routes
  router.addRoute({ path: '/dynamic', component: () => import('./index.vue') })
} catch (error) {
  outcome = (error as Error).message
}
</script>

<template>
  <p id="outcome">
    {{ outcome }}
  </p>
</template>
