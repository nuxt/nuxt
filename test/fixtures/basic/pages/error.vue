<template>
  <div>
    {{ state.attr }}
    {{ data.something }}
  </div>
</template>

<script setup>
const { data, error } = await useAsyncData(() => {
  throw new Error('some error')
}, { server: true })

if (error.value) {
  useCookie('some-error').value = 'was set'
  throw createError({ statusCode: 422, fatal: true, statusMessage: 'This is a custom error' })
}

const state = ref({ attr: 'Hello World' })
</script>
