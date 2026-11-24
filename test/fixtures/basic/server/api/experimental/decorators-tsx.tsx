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

  const vnode = <div id={new SomeClass().someMethod()} />
  return vnode.props!.id
})
