<template>
  <h1>User: {{ id }}</h1>
</template>

<script>
export default {
  data ({ params }) {
    return { id: params.id }
  }
}
</script>
