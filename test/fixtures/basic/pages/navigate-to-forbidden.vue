<template>
  <div>
    <div>navigate-to-forbidden.vue</div>
    <NuxtLink to="/catchall/forbidden">
      should throw a 404 error
    </NuxtLink>
    <NuxtLink to="/catchall/some-404">
      should be caught by catchall
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['override'],
  validate: to => to.path !== '/forbidden',
})
</script>
