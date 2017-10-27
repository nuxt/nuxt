<template lang="md">
  # Hello World!

  Current route is: {{ $route.path }}

  Data model is: {{ model }}

  <nuxt-link to="/about">Goto About</nuxt-link>
</template>

<<script>
export default {
  data () {
    return {
      model: 'abc'
    }
  }
}
</script>
