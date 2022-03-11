<script setup lang="ts">
import { throwError } from '#app'
const route = useRoute()
if ('setup' in route.query) {
  throw new Error('error in setup')
}
if ('mounted' in route.query) {
  onMounted(() => {
    throw new Error('error in mounted')
  })
}
function triggerError () {
  throw new Error('manually triggered error')
}
</script>

<template>
  <NuxtExampleLayout example="with-errors">
    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/" class="n-link-base">
          Home
        </NuxtLink>
        <NuxtLink to="/404" class="n-link-base">
          404
        </NuxtLink>
        <NuxtLink to="/?middleware" class="n-link-base">
          Middleware
        </NuxtLink>
        <button class="n-link-base" @click="throwError">
          Trigger fatal error
        </button>
        <button class="n-link-base" @click="triggerError">
          Trigger non-fatal error
        </button>
      </nav>
    </template>

    <template #footer>
      <div class="text-center p-4 op-50">
        Current route: <code>{{ route.path }}</code>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
