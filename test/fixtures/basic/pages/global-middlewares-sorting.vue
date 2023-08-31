<script setup lang="ts">
definePageMeta({
  middleware: [defineNuxtRouteMiddleware((to) => {
    const globalMiddleware: string[] | undefined = to.meta.globalMiddleware
    if (!globalMiddleware?.length)
      return createError('Missing to.meta.globalMiddleware')

    if (globalMiddleware.length !== 4)
      return createError('Missing to.meta.globalMiddleware')

    if (!globalMiddleware.every((m, idx) => (idx === 0 && m === '01.a.global') || (idx === 1 && m === '01.b.global') || (idx === 2 && m === 'a.global') || (idx === 3 && m === 'b.global')))
      return createError('Missmatch to.meta.globalMiddleware sorting order')
  })]
})
</script>
<template>
  <div>Global Middlewares Sorting</div>
</template>
