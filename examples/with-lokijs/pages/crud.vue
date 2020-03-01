<template>
  <v-row justify="center">
    <v-col cols="12" sm="10" md="8">
      <v-dialog v-model="dialog" persistent max-width="600px">
        <v-card>
          <v-card-title>
            <span class="headline"
              >{{ editItem.$loki ? "Edit" : "Create New" }} User Profile</span
            >
          </v-card-title>
          <v-card-text>
            <v-container>
              <v-row>
                <v-col cols="12" sm="6" md="4">
                  <v-text-field
                    v-model="editItem.name"
                    label="Legal first name*"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="4">
                  <v-text-field
                    v-model="editItem.lastName"
                    label="Legal last name*"
                    hint="Double check please"
                    persistent-hint
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6" md="4">
                  <v-text-field
                    v-model="editItem.age"
                    label="Age*"
                    required
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-container>
            <small>*indicates required field</small>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" text @click="dialog = false"
              >Close</v-btn
            >
            <v-btn
              color="blue darken-1"
              text
              @click="editItem.$loki ? saveUser() : addUser()"
              >{{ editItem.$loki ? "Save" : "Create" }}</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-card>
        <v-card-title class="headline">
          CRUD Example with asyncdata
        </v-card-title>
        <v-card-subtitle>
          {{ status }}
        </v-card-subtitle>
        <v-card-actions>
          <v-btn color="primary" dark @click="create">Add New User</v-btn>
        </v-card-actions>
        <v-card-text>
          <v-list>
            <v-subheader>Users</v-subheader>
            <v-divider />
            <template v-for="(user, index) in users">
              <v-list-item :key="index">
                <v-list-item-avatar>
                  <v-icon x-large color="amber">person</v-icon>
                </v-list-item-avatar>

                <v-list-item-content>
                  <v-list-item-title
                    ><nuxt-link :to="`/user/${user.$loki}`">{{
                      user.name
                    }}</nuxt-link>
                  </v-list-item-title>
                </v-list-item-content>
                <v-list-item-content>
                  <v-list-item-subtitle>{{
                    user.lastName
                  }}</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-content>
                  <v-list-item-title>{{ user.age }}</v-list-item-title>
                </v-list-item-content>
                <v-list-item-action>
                  <v-icon color="green" @click="edit(user)">edit</v-icon>
                </v-list-item-action>
                <v-list-item-action>
                  <v-icon color="red" @click="remove(user)">delete</v-icon>
                </v-list-item-action>
              </v-list-item>
            </template>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script>
export default {
  async asyncData({ $axios }) {
    const users = await $axios.$get(`/api/users`)
    return { users }
  },
  data() {
    return {
      status: process.server ? "Rendered on Server" : "Rendered on Client",
      editItem: {},
      dialog: false
    }
  },
  methods: {
    async addUser() {
      const user = await this.$axios.$post(`/api/users`, this.editItem)
      console.log("Added user", user)
      await this.reload()
      this.dialog = false
    },
    create() {
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
      await this.$axios.$delete(`/api/users/${user.$loki}`, user)
      await this.reload()
    },
    async saveUser() {
      const user = await this.$axios.$put(
        `/api/users/${this.editItem.$loki}`,
        this.editItem
      )
      console.log(user)
      await this.reload()
      this.dialog = false
    },
    async reload() {
      this.users = await this.$axios.$get(`/api/users`)
    }
  }
}
</script>
