export default defineComponent({
  render () {
    return (
      <div>
        TSX component
        <custom-component>custom</custom-component>
        <Counter multiplier={2} />
      </div>
    )
  },
})
