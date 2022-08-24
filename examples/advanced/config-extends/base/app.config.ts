export default defineAppConfig({
  bar: 'base',
  baz: 'base',
  array: () => [
    'base',
    'base',
    'base'
  ],
  arrayNested: {
    nested: {
      array: [
        'base',
        'base',
        'base'
      ]
    }
  }
})
