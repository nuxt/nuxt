<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      :mini-variant="miniVariant"
      :clipped="clipped"
      fixed
      overflow
      app
    >
      <v-list>
        <v-list-item
          v-for="(item, i) in items"
          :key="'x' + i"
          :to="item.to"
          router
          nuxt
          exact
        >
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title v-text="item.title" />
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar :clipped-left="clipped" fixed app>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title v-text="title" />
    </v-app-bar>
    <v-content>
      <v-container> <nuxt /> </v-container>
    </v-content>
    <v-footer :fixed="fixed" app> <span>&copy; 2020</span> </v-footer>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      clipped: false,
      drawer: false,
      fixed: false,
      items: [
        {
          icon: "apps",
          title: "Welcome",
          to: "/"
        },
        {
          icon: "done_all",
          title: "Hybrid",
          to: "/hybrid"
        },
        {
          icon: "sd_storage",
          title: "SSR VUEX",
          to: "/ssr-vuex"
        },
        {
          icon: "bubble_chart",
          title: "CRUD",
          to: "/crud"
        },
        {
          icon: "bubble_chart",
          title: "CRUD Fetch",
          to: "/crud-fetch"
        }
      ],
      miniVariant: false,
      title: "Nuxt CRUD Demo"
    }
  }
}
</script>
