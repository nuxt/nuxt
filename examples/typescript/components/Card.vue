<template>
  <div class="ba b--black-20 mw5 ma2">
    <img :src="'https://robots.johnlindquist.com/' + person.first_name + '_' + person.last_name" />
    <div class="flex flex-column items-center pa2 b--black-20">
      <div class="f4">{{person.first_name}} {{person.last_name}}</div>
      <button @click="select(person.id)" class="w-100 bg-blue dim mv2 pv2 bn pointer">Select</button>
    </div>
  </div>
</template>

<script lang="ts">
// PLEASE NOTE
// All "Nuxt Class Components" require at minimum a script tag that exports a default object
import Vue from 'vue'
import Component from 'nuxt-class-component'
import { Prop } from 'vue-property-decorator'
import { Action, namespace } from 'vuex-class'

import * as people from '~/store/modules/people'

const PeopleAction = namespace(people.name, Action)

@Component({})
export default class Card extends Vue {
  @Prop() person
  @PeopleAction select
}
</script>
