import { useQuery } from 'h3'

export default req => ({ query: useQuery(req) })
