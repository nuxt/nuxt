<template>
  <v-layout column justify-center
    ><v-dialog v-model="dialog" persistent max-width="600px">
      <v-card>
        <v-card-title>
          <span class="headline"
            >{{ editItem.$loki ? "Edit" : "Create New" }} User Profile</span
          >
        </v-card-title>
        <v-card-text>
          <v-container grid-list-md>
            <v-layout wrap>
              <v-flex xs12 sm6 md4>
                <v-text-field
                  v-model="editItem.name"
                  label="Legal first name*"
                  required
                ></v-text-field>
              </v-flex>
              <v-flex xs12 sm6 md4>
                <v-text-field
                  v-model="editItem.lastName"
                  label="Legal last name*"
                  hint="example of persistent helper text"
                  persistent-hint
                  required
                ></v-text-field>
              </v-flex>
              <v-flex xs12 sm6 md4>
                <v-text-field
                  v-model="editItem.age"
                  label="Age*"
                  required
                ></v-text-field>
              </v-flex>
              <!--
                <v-flex xs12 sm6>
                  <v-text-field label="Email*"></v-text-field>
                </v-flex>
                <v-flex xs12 sm6>
                  <v-autocomplete
                    :items="[
                      'Skiing',
                      'Ice hockey',
                      'Soccer',
                      'Basketball',
                      'Hockey',
                      'Reading',
                      'Writing',
                      'Coding',
                      'Basejump'
                    ]"
                    label="Interests"
                    multiple
                  ></v-autocomplete>
                </v-flex>
              -->
            </v-layout>
          </v-container>
          <small>*indicates required field</small>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" flat @click="dialog = false"
            >Close</v-btn
          >
          <v-btn
            color="blue darken-1"
            flat
            @click="editItem.$loki ? saveUser() : addUser()"
            >{{ editItem.$loki ? "Save" : "Create" }}</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-btn color="primary" dark @click="create">Add New User</v-btn>

    <v-flex xs-12>
      <v-list>
        <v-subheader>Users</v-subheader>
        <v-divider />
        <template v-for="(user, index) in users">
          <v-list-tile :key="index" avatar>
            <v-list-tile-avatar>
              <v-icon x-large color="amber">person</v-icon>
            </v-list-tile-avatar>

            <v-list-tile-content>
              <v-list-tile-title
                ><nuxt-link :to="`/user/${user.$loki}`">{{
                  user.name
                }}</nuxt-link></v-list-tile-title
              >
            </v-list-tile-content>
            <v-list-tile-content>
              <v-list-tile-sub-title>{{ user.lastName }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-content>
              <v-list-tile-title>{{ user.age }}</v-list-tile-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-icon color="green" @click="edit(user)">edit</v-icon>
            </v-list-tile-action>
            <v-list-tile-action>
              <v-icon color="red" @click="remove(user)">delete</v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </template>
      </v-list>
    </v-flex>
  </v-layout>
</template>

<script>
export default {
  data() {
    return { editItem: {}, dialog: false }
  },
  mounted() {
    this.baseUrl = window.location.origin
  },
  async asyncData({ $axios }) {
    const baseUrl = process.client ? window.location.origin : ""

    const users = await $axios.$get(`${baseUrl}/api/users`)
    return { users }
  },
  methods: {
    async addUser() {
      const user = await this.$axios.$post(
        `${this.baseUrl}/api/users`,
        this.editItem
      )
      console.log(user)
      await this.reload()
      this.dialog = false
    },
    create() {
      console.log("Creating")
      this.editItem = { name: "", age: 15, lastName: "" }
      this.dialog = true
    },
    edit(user) {
      console.log("Editiing", user)
      this.editItem = Object.assign({}, user)
      this.dialog = true
    },
    async remove(user) {
      console.log("Deleting", user)
      await this.$axios.$delete(`${this.baseUrl}/api/users/${user.$loki}`, user)
      await this.reload()
    },
    async saveUser() {
      const user = await this.$axios.$put(
        `${this.baseUrl}/api/users/${this.editItem.$loki}`,
        this.editItem
      )
      console.log(user)
      await this.reload()
      this.dialog = false
    },
    async reload() {
      this.users = await this.$axios.$get(`${this.baseUrl}/api/users`)
    }
  }
}
</script>
