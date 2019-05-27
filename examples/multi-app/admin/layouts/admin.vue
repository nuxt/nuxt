<template>
  <div>
    <Nav />
    <Nuxt />
  </div>
</template>

<script>
import Nav from '~admin/components/nav'

export default {
  layout: 'admin',
  components: {
    Nav
  }
}
</script>
