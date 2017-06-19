<template>
  <v-app>
    <v-toolbar>
      <v-toolbar-side-icon @click.native.stop="sidebar = !sidebar" />
      <v-toolbar-logo>Toolbar</v-toolbar-logo>
    </v-toolbar>
    <v-sidebar left fixed drawer v-model="sidebar">
      <v-list>
        <v-list-item>
          <v-list-tile router nuxt href="/">
            <v-list-tile-title>Home</v-list-tile-title>
          </v-list-tile>
        </v-list-item>
        <v-list-item>
          <v-list-tile router nuxt href="/about">
            <v-list-tile-title>About</v-list-tile-title>
          </v-list-tile>
        </v-list-item>
      </v-list>
    </v-sidebar>
    <main>
      <v-content>
        <v-container fluid>
          <nuxt/>
        </v-container>
      </v-content>
    </main>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      sidebar: false
    }
  }
}
</script>

<style scoped>
  .title {
    padding-left: 20px;
  }
</style>
