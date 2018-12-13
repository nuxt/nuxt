export default () => {
  const messageFromMiddleware: string = 'Message from a TS middleware !'
  console.log(`[${process.server ? 'Server' : 'Client'}]`, messageFromMiddleware)
}
