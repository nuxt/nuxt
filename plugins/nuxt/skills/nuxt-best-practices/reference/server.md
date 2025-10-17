# Nuxt Server Routes Best Practices

Guide to building robust server APIs with Nuxt's Nitro engine.

## Table of Contents

- [File-Based Routing](#file-based-routing)
- [Event Handlers](#event-handlers)
- [Request Handling](#request-handling)
- [Response Utilities](#response-utilities)
- [Error Handling](#error-handling)
- [Middleware](#middleware)
- [Database Integration](#database-integration)
- [Authentication](#authentication)

## File-Based Routing

### Directory Structure

```bash
server/
├── api/              # API routes (/api/*)
│   ├── users/
│   │   ├── index.get.ts       # GET /api/users
│   │   ├── index.post.ts      # POST /api/users
│   │   ├── [id].get.ts        # GET /api/users/:id
│   │   ├── [id].patch.ts      # PATCH /api/users/:id
│   │   └── [id].delete.ts     # DELETE /api/users/:id
│   └── auth/
│       ├── login.post.ts      # POST /api/auth/login
│       └── logout.post.ts     # POST /api/auth/logout
├── routes/           # Custom routes
│   └── sitemap.xml.ts
└── middleware/       # Server middleware
    └── auth.ts
```

### HTTP Method Naming

```typescript
// ✅ Good - Method in filename
users/index.get.ts      // GET /api/users
users/index.post.ts     // POST /api/users
users/[id].patch.ts     // PATCH /api/users/:id
users/[id].delete.ts    // DELETE /api/users/:id

// ❌ Bad - Generic filenames
users/list.ts           // Unclear method
users/create.ts         // Not RESTful
users/update.ts         // Not RESTful
```

## Event Handlers

### Basic Handler

```typescript
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  // Your logic here
  const users = await fetchUsers()
  return users
})
```

### With Type Safety

```typescript
// server/api/users/index.post.ts
interface CreateUserBody {
  name: string
  email: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateUserBody>(event)

  // Validate body
  if (!body.email || !body.name) {
    throw createError({
      statusCode: 400,
      message: 'Email and name are required'
    })
  }

  const user = await createUser(body)
  return user
})
```

## Request Handling

### Path Parameters

```typescript
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  const user = await db.users.findUnique({ where: { id } })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  return user
})
```

### Query Parameters

```typescript
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 10
  const search = query.search as string | undefined

  const users = await db.users.findMany({
    where: search ? {
      name: { contains: search, mode: 'insensitive' }
    } : undefined,
    skip: (page - 1) * limit,
    take: limit
  })

  const total = await db.users.count({
    where: search ? {
      name: { contains: search, mode: 'insensitive' }
    } : undefined
  })

  return {
    data: users,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
})
```

### Request Body

```typescript
// server/api/users/[id].patch.ts
interface UpdateUserBody {
  name?: string
  email?: string
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<UpdateUserBody>(event)

  // Validate at least one field is provided
  if (!body.name && !body.email) {
    throw createError({
      statusCode: 400,
      message: 'At least one field must be provided'
    })
  }

  const user = await db.users.update({
    where: { id },
    data: body
  })

  return user
})
```

### Headers

```typescript
export default defineEventHandler(async (event) => {
  // Get specific header
  const authHeader = getHeader(event, 'authorization')

  // Get all headers
  const headers = getHeaders(event)

  // Set response headers
  setResponseHeaders(event, {
    'X-Custom-Header': 'value'
  })

  return data
})
```

### Cookies

```typescript
export default defineEventHandler(async (event) => {
  // Get cookie
  const sessionId = getCookie(event, 'session')

  // Set cookie
  setCookie(event, 'session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7  // 7 days
  })

  // Delete cookie
  deleteCookie(event, 'session')

  return data
})
```

## Response Utilities

### Status Codes

```typescript
export default defineEventHandler(async (event) => {
  // Set status code
  setResponseStatus(event, 201)

  return { message: 'Created' }
})
```

### Redirects

```typescript
export default defineEventHandler(async (event) => {
  // Redirect
  return sendRedirect(event, '/new-location', 301)
})
```

### No Content

```typescript
// server/api/users/[id].delete.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  await db.users.delete({ where: { id } })

  // Return 204 No Content
  setResponseStatus(event, 204)
  return null
})
```

### Stream Response

```typescript
export default defineEventHandler(async (event) => {
  const stream = await getStreamFromDatabase()

  return sendStream(event, stream)
})
```

## Error Handling

### Creating Errors

```typescript
export default defineEventHandler(async (event) => {
  const user = await findUser()

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'User not found'
    })
  }

  return user
})
```

### Custom Error Data

```typescript
throw createError({
  statusCode: 400,
  message: 'Validation failed',
  data: {
    errors: [
      { field: 'email', message: 'Invalid email format' },
      { field: 'name', message: 'Name is required' }
    ]
  }
})
```

### Try-Catch Pattern

```typescript
export default defineEventHandler(async (event) => {
  try {
    const result = await riskyOperation()
    return result
  } catch (error) {
    console.error('Operation failed:', error)

    throw createError({
      statusCode: 500,
      message: 'Internal server error',
      data: process.dev ? error : undefined  // Only expose in dev
    })
  }
})
```

### Global Error Handler

```typescript
// server/middleware/error.ts
export default defineEventHandler((event) => {
  // This won't catch errors, use Nitro's error handling
  // Just log them
  event.node.res.on('finish', () => {
    if (event.node.res.statusCode >= 400) {
      console.error(`Error ${event.node.res.statusCode} on ${event.path}`)
    }
  })
})
```

## Middleware

### Authentication Middleware

```typescript
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  // Only protect /api routes
  if (!event.path.startsWith('/api')) {
    return
  }

  // Skip auth routes
  if (event.path.startsWith('/api/auth')) {
    return
  }

  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }

  try {
    const user = await verifyToken(token)
    event.context.user = user
  } catch (error) {
    throw createError({
      statusCode: 401,
      message: 'Invalid token'
    })
  }
})
```

### CORS Middleware

```typescript
// server/middleware/cors.ts
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  })

  // Handle preflight
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
```

### Request Logging

```typescript
// server/middleware/logger.ts
export default defineEventHandler((event) => {
  const start = Date.now()

  event.node.res.on('finish', () => {
    const duration = Date.now() - start
    console.log(
      `${event.method} ${event.path} ${event.node.res.statusCode} ${duration}ms`
    )
  })
})
```

## Database Integration

### Prisma Example

```typescript
// server/utils/db.ts
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}
```

### Using in Routes

```typescript
// server/api/users/index.get.ts
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true
    }
  })

  return users
})
```

### Transaction Example

```typescript
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: body.name, email: body.email }
    })

    await tx.profile.create({
      data: { userId: user.id, bio: body.bio }
    })

    return user
  })

  return result
})
```

## Authentication

### JWT Pattern

```typescript
// server/utils/auth.ts
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

export const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    throw new Error('Invalid token')
  }
}

// server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user || !(await verifyPassword(password, user.password))) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials'
    })
  }

  const token = generateToken(user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    token
  }
})
```

### Session Pattern

```typescript
// server/utils/session.ts
import { v4 as uuidv4 } from 'uuid'

const sessions = new Map<string, { userId: string; expiresAt: number }>()

export const createSession = (userId: string) => {
  const sessionId = uuidv4()
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 days

  sessions.set(sessionId, { userId, expiresAt })

  return sessionId
}

export const getSession = (sessionId: string) => {
  const session = sessions.get(sessionId)

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId)
    return null
  }

  return session
}

export const deleteSession = (sessionId: string) => {
  sessions.delete(sessionId)
}

// server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  const user = await authenticateUser(email, password)

  const sessionId = createSession(user.id)

  setCookie(event, 'session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  })

  return { user }
})
```

## Best Practices Summary

1. **Use file-based routing** with HTTP method suffixes
2. **Validate all inputs** - query params, body, path params
3. **Handle errors gracefully** with appropriate status codes
4. **Use middleware** for cross-cutting concerns (auth, CORS, logging)
5. **Type your handlers** with TypeScript interfaces
6. **Implement proper authentication** - JWT or sessions
7. **Use database connection pooling** - singleton pattern for clients
8. **Set appropriate status codes** - 201 for created, 204 for deleted
9. **Protect sensitive routes** with authentication middleware
10. **Log requests and errors** for debugging and monitoring
