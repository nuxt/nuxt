<template>
  <v-row justify="center" align="center">
    <v-col cols="12" sm="8" md="6">
      <v-card>
        <v-card-title class="headline">
          Hybrid users list
        </v-card-title>
        <v-card-subtitle>
          {{ status }}
        </v-card-subtitle>
        <v-card-text>
          <p>
            This examples uses Axios to obtain users list on client side and
            direct db call on serverside via ssrContext
          </p>

          <h4>Users in the Database</h4>

          <v-simple-table>
            <template v-slot:default>
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Surname</th>
                  <th class="text-left">Age</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(user, id) in users" :key="id">
                  <td>{{ user.name }}</td>
                  <td>{{ user.lastName }}</td>
                  <td>{{ user.age }}</td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script>
export default {
  async asyncData({ $axios, ssrContext }) {
    let users = []
    if (process.server) {
      users = ssrContext.$db.getCollection("users").data
    } else {
      users = await $axios.$get(`/api/users`)
    }
    console.log(
      `Asyncdata on ${process.server ? "SERVER" : "CLIENT"} loaded ${
        users.length
      } users`
    )
    return {
      status: process.server ? "Rendered on Server" : "Rendered on Client",
      users
    }
  },

  middleware() {
    console.log("-------------- Middleware SERVER", process.server)
  }
}
</script>
