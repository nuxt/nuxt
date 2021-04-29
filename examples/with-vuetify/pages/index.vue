<template>
  <v-container fill-height>
    <v-layout justify-center align-center>
      <v-flex shrink>
        <v-btn icon color="test" large @click="$vuetify.theme.dark = !$vuetify.theme.dark">
          <v-icon>mdi-theme-light-dark</v-icon>
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>
