<template>
  <div class="uk-card uk-card-body">
    <p>Hi from {{ name }}</p>
    <span class="uk-margin-small-right" uk-icon="icon: check"></span>
    <a href="#" uk-icon="icon: heart"></a>
    <hr class="uk-divider-icon">
    <nuxt-link to="/">Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  asyncData({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
