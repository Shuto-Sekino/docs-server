# TypeScript Patterns

## Type Utilities

```typescript
// Partial - all properties optional
type PartialUser = Partial<User>

// Required - all properties required
type RequiredConfig = Required<Config>

// Pick - subset of properties
type UserSummary = Pick<User, 'id' | 'name' | 'email'>

// Omit - exclude properties
type CreateUserInput = Omit<User, 'id' | 'createdAt'>

// Record - map type
type StatusMap = Record<string, boolean>

// ReturnType - extract return type
type FetchResult = ReturnType<typeof fetchUser>

// Awaited - unwrap Promise
type ResolvedData = Awaited<ReturnType<typeof fetchUser>>

// Parameters - extract param types
type HandlerParams = Parameters<typeof requestHandler>
```

## Narrowing

```typescript
// typeof
function process(val: string | number) {
  if (typeof val === 'string') {
    return val.toUpperCase()
  }
  return val * 2
}

// instanceof
function handle(err: unknown) {
  if (err instanceof Error) {
    console.error(err.message)
  }
}

// Type predicate
function isUser(val: unknown): val is User {
  return typeof val === 'object' && val !== null && 'id' in val
}

// Discriminated union
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

function handle<T>(result: Result<T>) {
  if (result.success) {
    console.log(result.data)   // data is accessible
  } else {
    console.error(result.error)
  }
}
```

## Generics

```typescript
// Generic function
function first<T>(arr: T[]): T | undefined {
  return arr[0]
}

// Constrained generic
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

// Generic with default
type ApiResponse<T = unknown> = {
  data: T
  status: number
}

// Conditional type
type NonNullable<T> = T extends null | undefined ? never : T
```

## Async Patterns

```typescript
// Typed fetch wrapper
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

// Error handling
async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<[T, null] | [null, Error]> {
  try {
    return [await fn(), null]
  } catch (err) {
    return [null, err instanceof Error ? err : new Error(String(err))]
  }
}

// Usage
const [data, err] = await safeAsync(() => fetchJson<User>('/api/user'))
if (err) { /* handle */ }
```

## satisfies Operator

```typescript
// Validates type without widening
const config = {
  port: 3000,
  host: 'localhost',
} satisfies Partial<ServerConfig>

// config.port is still number (not string | number)
```

## Template Literal Types

```typescript
type EventName = 'click' | 'focus' | 'blur'
type Handler = `on${Capitalize<EventName>}`
// 'onClick' | 'onFocus' | 'onBlur'

type CSSUnit = 'px' | 'em' | 'rem'
type CSSValue = `${number}${CSSUnit}`
// '16px' | '1em' | etc.
```

## Declaration Merging / Module Augmentation

```typescript
// Extend existing types
declare module 'express' {
  interface Request {
    user?: User
  }
}
```
