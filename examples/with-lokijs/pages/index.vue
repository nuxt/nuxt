<template>
  <v-layout column justify-center align-center>
    <v-flex xs12 sm8 md6>
      <v-card>
        <v-card-title class="headline">
          Welcome to the Loki.js + Nuxt.js demo
        </v-card-title>
        <v-card-text>
          <p>
            This demo showcases building CRUD app with embedded json database
            (Loki.js) and featuring Vuetify. Also it uses Nuxt ServerMiddleware
            and Express Router for creating a CRUD api.
          </p>

          <p>We use two (anti)patterns for communicating with DB.</p>
          <ul>
            <li>Through Vuex Store (Note, this is going to DB on every SSR)</li>
            <li>Through <i>/api</i> middleware doing all the DB CRUD comms</li>
          </ul>
          <br />
          <h4>Users in the Database (coming from Loki.js via Vuex store)</h4>
          <table
            style="  border: 2px solid grey; 
  border-collapse: collapse; "
          >
            <tr v-for="(user, id) in users" :key="id">
              <td style="border: 1px solid green;padding:5px">
                {{ user.name }}
              </td>
              <td style="border: 1px solid green;padding:5px">
                {{ user.lastName }}
              </td>
              <td style="border: 1px solid green;padding:5px">
                {{ user.age }}
              </td>
            </tr>
          </table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" flat nuxt to="/crud">
            Continue to CRUD demo
          </v-btn>
        </v-card-actions>
        <v-card-text>
          <hr class="my-3" />
          <h4>Related Links</h4>
          <ul>
            <li>
              <a href="https://nuxtjs.org/" target="_blank"> Nuxt </a> <br />
            </li>
            <li>
              <a href="http://lokijs.org/" target="_blank"> Loki.js </a> <br />
            </li>
            <li>
              <a href="https://vuetifyjs.com" target="_blank"> Vuetify </a>
            </li>
          </ul>
        </v-card-text>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
import { mapState } from "vuex"

export default {
  computed: mapState(["users"])
}
</script>
