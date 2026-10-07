export type StoredUserData<
  TProfile = Record<string, unknown>,
  TWorkout = Record<string, unknown> | null,
  TMessage = Record<string, unknown>,
  THistoryItem = Record<string, unknown>,
> = {
  profile?: TProfile
  workout?: TWorkout
  messages?: TMessage[]
  history?: THistoryItem[]
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const apiRequest = async <T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT'
    token?: string | null
    body?: unknown
  } = {},
): Promise<T> => {
  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })
  } catch {
    throw new ApiError('The persistence service could not be reached.', 0)
  }

  const result = await response.json().catch(() => ({})) as { error?: unknown } & T
  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : 'The persistence request failed.'
    throw new ApiError(message, response.status)
  }
  return result
}
