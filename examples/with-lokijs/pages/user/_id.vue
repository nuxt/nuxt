<template>
  <v-layout column justify-center align-center>
    <v-flex xs8 sm6 md4>
      <v-card>
        <v-img
          src="https://cdn.vuetifyjs.com/images/cards/desert.jpg"
          aspect-ratio="2.75"
        ></v-img>
        <v-card-title primary-title>
          <div>
            <h3 class="headline mb-0">{{ userData.name }}'s user details</h3>
            <hr class="my-3" />
            <div>
              Surname: <b>{{ userData.lastName }}</b>
            </div>
            <div>
              Name: <b>{{ userData.name }}</b>
            </div>
          </div>
        </v-card-title>
        <v-card-text>
          <h4>Age: {{ userData.age }}</h4>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" flat nuxt to="/crud">
            Back to users list
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-flex>
  </v-layout></template
>

<script>
export default {
  data() {
    return { userData: {} }
  },
  mounted() {
    // this.baseUrl = window.location.origin
  },
  async asyncData({ $axios, route }) {
    const baseUrl = process.client ? window.location.origin : ""

    const userData = await $axios.$get(
      `${baseUrl}/api/users/${route.params.id}`
    )
    console.log(userData)
    return { userData }
  }
  //   computed: mapState(["users"])
}
</script>
