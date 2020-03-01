<template>
  <v-row justify="center" align="center">
    <v-col cols="8" sm="6" md="4">
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
          <v-btn color="primary" text nuxt to="/crud">
            Back to users list
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>

<script>
export default {
  async asyncData({ $axios, route }) {
    const userData = await $axios.$get(`/api/users/${route.params.id}`)
    return { userData }
  }
}
</script>
