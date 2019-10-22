<template>
  <div class="uk-card uk-card-body">
    <p>Hi from {{ name }}</p>
    <span class="uk-margin-small-right" uk-icon="icon: check" />
    <a href="#" uk-icon="icon: heart" />
    <hr class="uk-divider-icon">
    <NuxtLink to="/">
      Home page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  asyncData ({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
