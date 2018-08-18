<template>
  <section class="pa4">
    <div class="bg-white-90 pa4">
      <div class="f1">Nuxt TypeScript Starter</div>
      <div class="f3">Selected Person: {{ selectedPerson.first_name }} {{ selectedPerson.last_name }}</div>
      {{ selected }}
    </div>
    <div class="flex flex-wrap ph2 justify-between bg-white-80">
      <div v-for="person in people" :key="person.id">
        <Card :person="person"/>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'nuxt-class-component'
import Card from '~/components/Card.vue'
import { State, Getter, namespace } from 'vuex-class'

import * as people from '~/store/modules/people'

const PeopleState = namespace(people.name, State)
const PeopleGetter = namespace(people.name, Getter)

export default
@Component({
  components: {
    Card
  }
})
class extends Vue {
  @PeopleState selected
  @PeopleState people
  @PeopleGetter selectedPerson
}
</script>
