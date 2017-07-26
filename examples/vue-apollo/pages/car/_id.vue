<template>
  <section>
    <article class="car-art">
      <span>{{Car.make}}</span><br>
      <span>{{Car.model}}</span><br>
      <span>{{Car.year}}</span>
    </article>
    <nuxt-link to="/">Home</nuxt-link>
  </section>
</template>

<script>
import gql from 'graphql-tag'

export default {
  name: "Car",
  apollo: {
    Car: {
      query: gql`query car($id: ID) {Car(id: $id) {make model year}}`,
      variables () { 
        return {
          id: this.$route.params.id
        }
      }
    }
  },
  data () {
    return {
      Car: {}
    }
  }
}
</script>