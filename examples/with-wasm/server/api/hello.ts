import sample from './sample.wasm'

export default async () => {
  const { instance } = await sample({})

  return {
    result: instance.exports.main()
  }
}
