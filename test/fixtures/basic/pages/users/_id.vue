<template>
  <h1>User: {{ id }}</h1>
</template>

<script>
export default {
  asyncData ({ params }) {
    return { id: params.id }
  }
}
</script>
