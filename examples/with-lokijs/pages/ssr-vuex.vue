<template>
  <v-row justify="center" align="center">
    <v-col cols="12" sm="8" md="6">
      <v-card>
        <v-card-title class="headline">
          Server side rendered Vuex Store
        </v-card-title>
        <v-card-subtitle>
          {{ status }}
        </v-card-subtitle>
        <v-card-text>
          <p>
            In this example data is loaded into VUEX store in server side from
            LokiJs db. Note, Loki.js is initialised in a local module
            'dbconnector.js' during nuxt server's start. Then it's injected into
            ssrContext in a "vue-renderer:ssr:prepareContext" hook. The key part
            is that then it's available to every server side plugin, request,
            middleware via "ssrContext.$db". This can be seen in our example in
            Vuex nuxtServerInit method.
          </p>

          <h4>Users in the Database (coming from Loki.js via Vuex store)</h4>

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
import { mapState } from "vuex"

export default {
  data() {
    return {
      status: process.server ? "Rendered on Server" : "Rendered on Client"
    }
  },
  computed: mapState(["users"])
}
</script>
