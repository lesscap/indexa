export type ApiResponse<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      code: string
      message: string
    }

export type ConsoleSession = {
  id: string
  username: string
  name: string
  currentDomainId: string
  domain: {
    id: string
    slug: string
    name: string
  }
}

export type LibrarySummary = {
  id: string
  domainId: string
  slug: string
  name: string
  description: string | null
  status: string
  createdAt: string
  activeIndex: {
    id: string
    version: number
    status: string
    embeddingMethod: {
      id: string
      slug: string
      name: string
      provider: string
      model: string
    }
  } | null
}

export type LibraryDetail = LibrarySummary & {
  documentCount: number
}

export type DocumentSummary = {
  id: string
  title: string
  originalName: string
  mimeType: string
  sizeBytes: string
  checksumSha256: string
  storagePath: string
  createdAt: string
  updatedAt: string
  currentIndexState: {
    id: string
    status: string
    stage: string | null
    lastIndexedAt: string | null
    errorMessage: string | null
    updatedAt: string
  } | null
}

export type ApiClientError = Error & {
  code: string
  status: number
}

const createApiError = (message: string, code: string, status: number): ApiClientError => {
  return Object.assign(new Error(message), {
    code,
    status,
  })
}

const readJson = async <T>(response: Response) => {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    throw createApiError('Expected a JSON response.', 'INVALID_RESPONSE', response.status)
  }

  return (await response.json()) as ApiResponse<T>
}

const request = async <T>(input: string, init?: RequestInit) => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  })
  const payload = await readJson<T>(response)

  if (!payload.success) {
    throw createApiError(payload.message, payload.code, response.status)
  }

  return payload.data
}

export const getConsoleSession = async () => {
  const response = await fetch('/api/console/session', {
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  const payload = await readJson<{ session: ConsoleSession }>(response)

  if (!payload.success) {
    throw createApiError(payload.message, payload.code, response.status)
  }

  return payload.data.session
}

export const loginToConsole = async (username: string, password: string) => {
  const data = await request<{ session: ConsoleSession }>('/api/console/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  return data.session
}

export const logoutFromConsole = async () => {
  await request<{ loggedOut: true }>('/api/console/session', {
    method: 'DELETE',
  })
}

export const listLibraries = async () => {
  const data = await request<{ list: LibrarySummary[] }>('/api/console/libraries')

  return data.list
}

export const createLibrary = async (input: {
  name: string
  slug?: string
  description?: string
}) => {
  const data = await request<{ library: LibrarySummary }>('/api/console/libraries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      embeddingMethodSlug: 'qwen-text-embedding-v3',
    }),
  })

  return data.library
}

export const getLibrary = async (libraryId: string) => {
  const data = await request<{ library: LibraryDetail }>(`/api/console/libraries/${libraryId}`)

  return data.library
}

export const listDocuments = async (libraryId: string) => {
  const data = await request<{ list: DocumentSummary[] }>(
    `/api/console/libraries/${libraryId}/documents`,
  )

  return data.list
}

export const uploadDocument = async (libraryId: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  return request<{
    document: DocumentSummary
    documentIndexState: {
      id: string
      status: string
      stage: string | null
      lastIndexedAt: string | null
      errorMessage: string | null
      updatedAt: string
    }
    job: {
      id: string
      status: string
      stage: string | null
      progressCurrent: number | null
      progressTotal: number | null
      progressUnit: string | null
      createdAt: string
    }
  }>(`/api/console/libraries/${libraryId}/documents`, {
    method: 'POST',
    body: formData,
  })
}
