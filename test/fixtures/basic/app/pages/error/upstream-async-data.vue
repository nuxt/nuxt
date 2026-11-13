<script setup lang="ts">
const { error: fetchError } = await useFetch('/api/upstream-failure')
const { error: thrownError } = await useAsyncData('upstream-async-data-thrown', () => {
  throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.3:5432 thrown-secret'), {
    data: { secret: 'thrown-secret-data' },
  })
})
const { error: httpError } = await useAsyncData('upstream-async-data-http', () => {
  throw createError({ status: 422, statusText: 'Unprocessable Entity', message: 'Invalid input', data: { reason: 'invalid-input' } })
})
</script>

<template>
  <div>
    <div id="fetch-error">
      {{ fetchError?.status }} {{ fetchError?.data }}
    </div>
    <div id="thrown-error">
      {{ thrownError?.status }} {{ thrownError?.message }}
    </div>
    <div id="http-error">
      {{ httpError?.status }} {{ httpError?.message }} {{ httpError?.data?.reason }}
    </div>
  </div>
</template>
