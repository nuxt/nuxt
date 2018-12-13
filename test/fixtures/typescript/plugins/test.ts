export default () => {
  const messageFromPlugin: string = 'Message from a TS plugin !'
  console.log(`[${process.server ? 'Server' : 'Client'}]`, messageFromPlugin)
}
