<script setup lang="ts">
const route = useRoute()
const timer = useState('timer', () => 0)
</script>

<template>
  <NuxtExampleLayout show-tips example="with-universal-router">
    A page...
    <br>

    <template v-if="timer">
      Processing navigation in 0.{{ timer }}s
    </template>

    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/" class="n-link-base">
          Home
        </NuxtLink>
        <NuxtLink to="/forbidden" class="n-link-base">
          Forbidden
        </NuxtLink>
        <NuxtLink to="/redirect" class="n-link-base">
          Redirect
        </NuxtLink>
      </nav>
    </template>

    <template #footer>
      <div class="text-center p-4 op-50">
        Current route: <code>{{ route.path }}</code>
      </div>
    </template>

    <template #tips>
      <div>
        <p>
          This example demonstrates Nuxt universal routing utilities without depending on `pages/` and `vue-router`.
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
