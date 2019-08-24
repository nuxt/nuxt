const createData = async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  return {
    build: {
      terser: true
    },
    head: {
      title: 'Async Config!'
    }
  }
}

export default createData
