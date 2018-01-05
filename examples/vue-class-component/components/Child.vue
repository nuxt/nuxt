<template>
  <div>
    <input v-model="msg">
    <p>msg: {{msg}}</p>
    <p>env: {{env}}</p>
    <p>computed msg: {{computedMsg}}</p>
    <button @click="greet">Greet</button>
    <p><nuxt-link to="/about">About page</nuxt-link></p>
  </div>
</template>

<script>
import Component from 'nuxt-class-component'
import Base from '@/components/Base'

@Component
export default class Child extends Base {
  // override parent method
  greet() {
    console.log('child greeting: ' + this.msg) // eslint-disable-line no-console
  }
}
</script>
