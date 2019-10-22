<template>
  <div>
    <h1>Info</h1>
    <p>Details: {{ info.message.title }}</p>
    <nuxt-link to="/">
      back
    </nuxt-link>
  </div>
</template>

<script>
export default {
  data () {
    return {
      info: {}
    }
  }
}
</script>
