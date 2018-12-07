<template>
  <v-app id="inspire" dark>
    <v-navigation-drawer
      v-model="drawer"
      clipped
      fixed
      app
    >
      <v-list dense>
        <v-list-group v-for="item in items" :key="item.title" :value="item.active">
          <v-list-tile slot="item">
            <v-list-tile-action>
              <v-icon>{{ item.action }}</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ item.title }}</v-list-tile-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-icon v-if="item.items">
                keyboard_arrow_down
              </v-icon>
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile v-for="subItem in item.items" :key="subItem.title">
            <v-list-tile-content>
              <v-list-tile-title>{{ subItem.title }}</v-list-tile-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-icon>{{ subItem.action }}</v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </v-list-group>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar app fixed clipped-left>
      <v-toolbar-side-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>Application</v-toolbar-title>
    </v-toolbar>
    <v-content>
      <v-container grid-list-md text-xs-center>
        <v-layout row wrap>
          <v-flex xs12>
            <v-card dark color="primary">
              <v-card-text class="px-0">
                <slot />
              </v-card-text>
            </v-card>
          </v-flex>
        </v-layout>
      </v-container>

      <v-container fluid fill-height>
        <v-layout justify-center align-center>
          <v-tooltip right>
            <v-btn slot="activator" :href="source" icon large target="_blank">
              <v-icon large>
                code
              </v-icon>
            </v-btn>
            <span>Source</span>
          </v-tooltip>
        </v-layout>
      </v-container>
    </v-content>
    <v-footer app fixed>
      <span>&copy; 2017</span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  name: 'Layout',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    source: {
      type: String,
      default: ''
    }
  },
  data: () => ({
    drawer: null
  })
}
</script>

<style type="text/css">
@import url("https://fonts.googleapis.com/css?family=Roboto:300,400,500,700|Material+Icons");
</style>
