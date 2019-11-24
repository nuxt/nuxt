const createData = async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  return {
    build: {
      // without terser enabled the size-limit unit test fails
      terser: true
    },
    head: {
      title: 'Async Config!'
    },
    modern: 'server'
  }
}

export default createData
