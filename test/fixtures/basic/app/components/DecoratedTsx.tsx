function something (_method: () => unknown) {
  return () => 'decorated'
}

class SomeClass {
  @something
  public someMethod () {
    return 'initial'
  }
}

export default defineComponent({
  render: () => <span>{new SomeClass().someMethod()}</span>,
})
