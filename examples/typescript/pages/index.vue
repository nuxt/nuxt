<template>
  <section class="pa4">
    <div class="bg-white-90 pa4">
      <div class="f1">Nuxt TypeScript Starter</div>
      <div class="f3">Selected Person: {{selectedPerson.first_name}} {{selectedPerson.last_name}}</div>
      {{selected}}
    </div>
    <div class="flex flex-wrap ph2 justify-between bg-white-80">
      <div v-for="person in people">
        <Card :person="person"></Card>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'nuxt-class-component'
import Card from '~/components/Card'
import { State, Getter } from 'vuex-class'

@Component({
  components: {
    Card
  }
})
export default class extends Vue {
  @State selected
  @State people
  @Getter selectedPerson
}
</script>
