/**
 * sometimes, CMS wants to give full control on components. This might not be a good practice.
 * SO MAKE SURE TO SANITIZE ALL YOUR STRINGS
 */
import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  return {
    props: ['lastname', 'firstname'],
    // don't forget to sanitize
    setup: `
      const fullName = computed(() => props.lastname + ' ' + props.firstname);

      const count = ref(0);

      return {fullName, count}
    `,
    template: '<div>my name is {{ fullName }}, <button data-testid="inc-interactive-count" @click="count++">click here</button> count: <span data-testid="interactive-count">{{count}}</span>. I am defined by Interactive in the setup of App.vue. My full component definition is retrieved from the api </div>',
  }
})
