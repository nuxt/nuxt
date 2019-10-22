<template>
  <v-app>
    <v-toolbar color="primary" dark>
      <v-toolbar-side-icon @click.native.stop="drawer = !drawer" />
      <v-toolbar-title>Toolbar</v-toolbar-title>
    </v-toolbar>
    <v-navigation-drawer v-model="drawer" left fixed app>
      <v-list>
        <v-list-tile router nuxt href="/">
          <v-list-tile-title>Home</v-list-tile-title>
        </v-list-tile>
        <v-list-tile router nuxt href="/about">
          <v-list-tile-title>About</v-list-tile-title>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>
    <main>
      <v-content>
        <v-container fluid>
          <nuxt />
        </v-container>
      </v-content>
    </main>
  </v-app>
</template>

<script>
export default {
  data () {
    return {
      drawer: false
    }
  }
}
</script>

<style scoped>
  .title {
    padding-left: 20px;
  }
</style>
