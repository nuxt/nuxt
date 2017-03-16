import axios from 'axios'

export default axios.create({
  baseURL: 'https://nuxt-firebase.firebaseio.com'
})
