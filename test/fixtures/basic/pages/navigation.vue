<template>
  <div>
    <h3>Click one of the links below and navigate back in history before the page has fully loaded. Pass if no error page shown.</h3>
    <ul>
      <li v-for="test in tests" :key="test">
        <nuxt-link :to="'navigation/' + test">
          {{ test }}
        </nuxt-link>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  computed: {
    tests () {
      return [
        'asyncData-error',
        'asyncData-throw',
        'middleware-asyncData-error',
        'middleware-asyncData-throw'
      ]
    }
  }
}
</script>
