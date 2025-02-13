export default eventHandler((_event) => {
  function something (_method: () => unknown) {
    return () => 'decorated'
  }

  class SomeClass {
    @something
    public someMethod () {
      return 'initial'
    }
  }

  return new SomeClass().someMethod()
})
