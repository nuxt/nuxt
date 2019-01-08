<template>
  <section class="pa4">
    <div class="bg-white-90 pa4">
      <div class="f1">
        Nuxt TypeScript Starter
      </div>
      <div class="f3">
        Selected Person: {{ selectedPerson.first_name }} {{ selectedPerson.last_name }}
      </div>
      {{ selected }}
    </div>
    <div class="flex flex-wrap ph2 justify-between bg-white-80">
      <div v-for="person in people" :key="person.id">
        <Card :person="person" />
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import Card from '~/components/Card.vue'
import { namespace } from 'vuex-class'

import * as people from '~/store/modules/people'

const People = namespace(people.name)

@Component({
  components: {
    Card
  }
})
export default class IndexPage extends Vue {
  @People.State selected
  @People.State people
  @People.Getter selectedPerson
}
</script>
