<script setup lang="ts">
const router = useRouter()

// the route record is the matcher's own object, so it is the same one only when the
// matcher is shared between requests
const record = router.getRoutes().find(route => route.path === '/')
const state = globalThis as { __lastRecord?: unknown }
const shared = import.meta.server && state.__lastRecord === record
if (import.meta.server) {
  state.__lastRecord = record
}

let addRouteError = ''
if (import.meta.server) {
  try {
    router.addRoute({ path: '/added', component: () => import('./other.vue') })
  } catch (error) {
    addRouteError = (error as Error).message
  }
}
</script>

<template>
  <div>
    <p id="shared">
      {{ shared }}
    </p>
    <p id="add-route">
      {{ addRouteError }}
    </p>
  </div>
</template>
