<template>
  <p>Hi from {{ name }}</p>
</template>

<script>
export default {
  data ({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
