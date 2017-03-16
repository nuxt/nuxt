<template>
  <v-app top-toolbar left-fixed-sidebar>
    <v-toolbar>
      <v-toolbar-side-icon @click.native.stop="sidebar = !sidebar" />
      <v-toolbar-logo>Toolbar</v-toolbar-logo>
    </v-toolbar>
    <main>
      <v-sidebar left fixed drawer v-model="sidebar">
        <v-list>
          <v-list-item v-for="i in 3">
            <v-list-tile>
              <v-list-tile-title>Item {{ i }}</v-list-tile-title>
            </v-list-tile>
          </v-list-item>
        </v-list>
      </v-sidebar>
      <v-content>
        <v-container fluid>
          <div class="title">Main Content</div>
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

<style>
  .title {
    padding-left: 20px;
  }
</style>
