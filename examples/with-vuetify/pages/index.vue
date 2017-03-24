<template>
  <v-app top-toolbar left-fixed-sidebar>
    <v-toolbar>
      <v-toolbar-side-icon @click.native.stop="sidebar = !sidebar" />
      <v-toolbar-logo>Toolbar</v-toolbar-logo>
    </v-toolbar>
    <main>
      <v-sidebar left fixed drawer v-model="sidebar">
        <v-list>
          <v-list-item v-for="i in 3" :key="i">
            <v-list-tile>
              <v-list-tile-title>Item {{ i }}</v-list-tile-title>
            </v-list-tile>
          </v-list-item>
        </v-list>
      </v-sidebar>
      <v-content>
        <v-container fluid>
          <div class="title">
            <h2>Main content</h2>
            <v-btn primary>Primary button</v-btn>
            <v-btn secondary>Secondary button</v-btn>
            <v-btn success>Success button</v-btn>
          </div>
        </v-container>
      </v-content>
    </main>
  </v-app>
</template>

<script>
  export default {
    asyncData() {
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
