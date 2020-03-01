<template>
  <v-row justify="center" align="center">
    <v-col cols="12" sm="10" md="8">
      <v-card>
        <v-card-title class="headline">
          Welcome to the Loki.js + Nuxt.js demo
        </v-card-title>
        <v-card-subtitle>
          {{ status }}
        </v-card-subtitle>
        <v-card-text>
          <p>
            This demo showcases building CRUD app with embedded json database (
            <a href="http://lokijs.org/" target="_blank"> Loki.js </a>) and
            featuring
            <a href="https://vuetifyjs.com" target="_blank"> Vuetify </a>. Also
            it uses Nuxt ServerMiddleware, new Fetch, local modules, hooks and
            Express Router for creating a CRUD api.
          </p>

          <p>We use following (anti)patterns for communicating with DB.</p>
          <ul>
            <li>
              <v-btn color="primary" small text nuxt to="/ssr-vuex">
                SSR
              </v-btn>
              Through Vuex Store initialised on server
            </li>
            <li>
              <v-btn color="primary" small text nuxt to="/hybrid">
                Hybrid
              </v-btn>
              Using Axios on client and db calls on server
            </li>
            <li>
              <v-btn color="primary" small text nuxt to="/crud">
                CRUD with AsyncData
              </v-btn>
              Through <i>/api</i> middleware doing all the DB CRUD communication
            </li>
            <li>
              <v-btn color="primary" small text nuxt to="/crud">
                CRUD with new Fetch
              </v-btn>
              Through <i>/api</i> middleware doing all the DB CRUD communication
            </li>
          </ul>
        </v-card-text>

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
