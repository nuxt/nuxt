export default defineNuxtComponent({
  props: ['template', 'name'],

  /**
   * most of the time, vue compiler need at least a VNode, use h() to render the component
   */
  render () {
    return h({
      props: ['name'],
      template: this.template
    }, {
      name: this.name
    })
  }
})
