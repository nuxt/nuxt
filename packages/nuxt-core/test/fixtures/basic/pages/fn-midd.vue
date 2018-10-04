<template>
  <h1>Date: {{ date }}</h1>
</template>

<script>
let date

export default {
  middleware: ({ query, error }) => {
    if (!query.please) return error({ message: 'You need to ask the permission', statusCode: 403 })
    date = Date.now()
  },
  asyncData() {
    return { date }
  }
}
</script>
