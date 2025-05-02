<template>
  <div>
    <h1>[...slug].vue</h1>
    <div>catchall at {{ route.params.slug?.[0] }}</div>
    <div>Middleware ran: {{ !!($route.meta.override as any)?.includes('extended middleware') }}</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['override', (to) => {
    if (to.path === '/catchall/forbidden') {
      throw createError({
        statusCode: 500,
        message: 'This middleware should not be run',
      })
    }
  }],
  validate: to => to.path !== '/catchall/forbidden',
})
const route = useRoute('catchall-slug')
if (route.path.includes('navigate-some-path')) {
  throw createError('navigate-some-path setup running')
}
</script>
