import { defineTool } from 'eve/tools'
import { z } from 'zod'

export default defineTool({
  description: 'Get the current weather for a city.',
  inputSchema: z.object({ city: z.string().min(1) }),
  label: {
    start: ({ city }) => `Checking the weather in ${city}`,
  },
  execute ({ city }) {
    // Replace with a call to a real weather API.
    return { city, condition: 'Sunny', temperatureC: 22 }
  },
})
