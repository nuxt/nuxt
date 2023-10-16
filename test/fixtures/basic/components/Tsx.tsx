export default defineComponent({
  render () {
    return <div>
      TSX component
      <custom-component>custom</custom-component>
      <SugarCounter multiplier={2} />
    </div>
  }
})
