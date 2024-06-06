const createData = async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  return {
    build: {
      postcss: {
        postcssOptions: () => ({
          plugins: [
            ['postcss-preset-env', { features: { 'custom-selectors': true } }]
          ]
        })
      }
    }
  }
}

export default createData
