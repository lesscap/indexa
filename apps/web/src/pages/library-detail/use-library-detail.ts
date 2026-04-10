import Uppy from '@uppy/core'
import Tus from '@uppy/tus'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelTusUpload,
  type DocumentSummary,
  getLibrary,
  type LibraryDetail,
  listDocuments,
  listUploads,
  type UploadSessionSummary,
} from '@/lib/api'
import type { LocalUpload } from './types'
import { hasLiveRemoteUpload } from './utils'

const CANCEL_SETTLE_MS = 5_000

const isLiveUpload = (upload: UploadSessionSummary) => {
  return upload.status === 'CREATED' || upload.status === 'UPLOADING'
}

const findMatchingRemoteUpload = (localUpload: LocalUpload, uploads: UploadSessionSummary[]) => {
  return uploads.find(upload => {
    return (
      isLiveUpload(upload) &&
      upload.originalName === localUpload.name &&
      upload.mimeType === localUpload.mimeType &&
      Number(upload.sizeBytes) === localUpload.sizeBytes
    )
  })
}

export const useLibraryDetail = (libraryId: string) => {
  const [library, setLibrary] = useState<LibraryDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [uploads, setUploads] = useState<UploadSessionSummary[]>([])
  const [localUploads, setLocalUploads] = useState<Record<string, LocalUpload>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cancelingUploadIdsRef = useRef(new Set<string>())
  const uppyRef = useRef<Uppy<
    { libraryId: string; name: string; type: string },
    Record<string, never>
  > | null>(null)

  const localUploadList = useMemo(() => Object.values(localUploads), [localUploads])
  const hasLocalUpload = localUploadList.length > 0
  const hasCancelingLocalUpload = useMemo(
    () => localUploadList.some(upload => upload.status === 'CANCELLING'),
    [localUploadList],
  )
  const hasRemoteUpload = useMemo(() => hasLiveRemoteUpload(uploads), [uploads])
  const hasActiveUpload = hasLocalUpload || hasRemoteUpload

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [nextLibrary, nextDocuments, nextUploads] = await Promise.all([
          getLibrary(libraryId),
          listDocuments(libraryId),
          listUploads(libraryId),
        ])

        if (cancelled) {
          return
        }

        setLibrary(nextLibrary)
        setDocuments(nextDocuments)
        setUploads(nextUploads)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load library.')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [libraryId])

  useEffect(() => {
    const uppy = new Uppy<{ libraryId: string; name: string; type: string }, Record<string, never>>(
      {
        autoProceed: true,
        restrictions: {
          maxNumberOfFiles: 1,
        },
      },
    )

    uppy.use(Tus, {
      endpoint: '/api/console/uploads',
      withCredentials: true,
      allowedMetaFields: ['libraryId', 'name', 'type'],
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 5 * 1024 * 1024,
    })

    uppy.on('file-added', file => {
      setLocalUploads({
        [file.id]: {
          id: file.id,
          tusUploadId: null,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size ?? 0,
          bytesReceived: 0,
          status: 'UPLOADING',
          errorMessage: null,
          retryable: false,
          cancelRequestedAt: null,
          remoteCancelRequested: false,
        },
      })
    })

    uppy.on('upload-progress', (file, progress) => {
      if (!file) {
        return
      }

      setLocalUploads(current => {
        const existing = current[file.id]

        if (!existing) {
          return current
        }

        return {
          ...current,
          [file.id]: {
            ...existing,
            tusUploadId: file.tus?.uploadUrl?.split('/').pop() || existing.tusUploadId,
            bytesReceived: progress.bytesUploaded,
            sizeBytes: progress.bytesTotal ?? existing.sizeBytes,
            status: existing.status === 'CANCELLING' ? existing.status : 'UPLOADING',
            errorMessage: null,
            retryable: false,
            cancelRequestedAt: existing.cancelRequestedAt,
            remoteCancelRequested: existing.remoteCancelRequested,
          },
        }
      })
    })

    uppy.on('restriction-failed', (_file, uploadFailure) => {
      setUploadError(uploadFailure.message)
    })

    uppy.on('upload-error', (file, uploadFailure) => {
      setUploadError(uploadFailure.message)

      if (!file) {
        return
      }

      setLocalUploads(current => {
        const existing = current[file.id]

        if (!existing || existing.status === 'CANCELLING') {
          return current
        }

        return {
          ...current,
          [file.id]: {
            ...existing,
            tusUploadId: file.tus?.uploadUrl?.split('/').pop() || existing.tusUploadId,
            status: 'FAILED',
            errorMessage: uploadFailure.message,
            retryable: true,
            cancelRequestedAt: null,
            remoteCancelRequested: false,
          },
        }
      })
    })

    uppy.on('upload-success', async file => {
      setUploadError(null)

      if (file) {
        cancelingUploadIdsRef.current.delete(file.id)
        setLocalUploads(current => {
          const next = { ...current }
          delete next[file.id]
          return next
        })
      } else {
        setLocalUploads({})
      }

      uppy.clear()

      const [nextDocuments, nextUploads] = await Promise.all([
        listDocuments(libraryId),
        listUploads(libraryId),
      ])

      setDocuments(nextDocuments)
      setUploads(nextUploads)
    })

    uppy.on('file-removed', file => {
      if (cancelingUploadIdsRef.current.has(file.id)) {
        return
      }

      setLocalUploads(current => {
        const next = { ...current }
        delete next[file.id]
        return next
      })
    })

    uppyRef.current = uppy

    return () => {
      uppy.destroy()
      uppyRef.current = null
    }
  }, [libraryId])

  useEffect(() => {
    if (!hasRemoteUpload && !hasCancelingLocalUpload) {
      return
    }

    const timer = window.setInterval(() => {
      void listUploads(libraryId)
        .then(async nextUploads => {
          setUploads(nextUploads)

          const cancelRequests: Array<{ uploadId: string; tusUploadId: string }> = []

          setLocalUploads(current => {
            let hasChanged = false
            const now = Date.now()
            const next = { ...current }

            for (const [uploadId, upload] of Object.entries(current)) {
              if (upload.status !== 'CANCELLING') {
                continue
              }

              const matchedRemoteUpload = upload.tusUploadId
                ? nextUploads.find(remoteUpload => remoteUpload.tusUploadId === upload.tusUploadId)
                : findMatchingRemoteUpload(upload, nextUploads)

              if (matchedRemoteUpload) {
                if (!upload.tusUploadId || upload.tusUploadId !== matchedRemoteUpload.tusUploadId) {
                  next[uploadId] = {
                    ...upload,
                    tusUploadId: matchedRemoteUpload.tusUploadId,
                  }
                  hasChanged = true
                }

                if (!upload.remoteCancelRequested) {
                  next[uploadId] = {
                    ...(next[uploadId] || upload),
                    remoteCancelRequested: true,
                  }
                  cancelRequests.push({
                    uploadId,
                    tusUploadId: matchedRemoteUpload.tusUploadId,
                  })
                  hasChanged = true
                }

                continue
              }

              if (upload.cancelRequestedAt && now - upload.cancelRequestedAt < CANCEL_SETTLE_MS) {
                continue
              }

              cancelingUploadIdsRef.current.delete(uploadId)
              delete next[uploadId]
              hasChanged = true
            }

            return hasChanged ? next : current
          })

          await Promise.all(
            cancelRequests.map(async ({ uploadId, tusUploadId }) => {
              try {
                await cancelTusUpload(tusUploadId)
              } catch (cancelError) {
                setUploadError(
                  cancelError instanceof Error ? cancelError.message : 'Cancel failed.',
                )
                setLocalUploads(current => {
                  const existing = current[uploadId]

                  if (!existing) {
                    return current
                  }

                  return {
                    ...current,
                    [uploadId]: {
                      ...existing,
                      remoteCancelRequested: false,
                    },
                  }
                })
              }
            }),
          )
        })
        .catch(() => {})
    }, 2000)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasCancelingLocalUpload, hasRemoteUpload, libraryId])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file || !uppyRef.current) {
      return
    }

    setUploadError(null)

    try {
      await uppyRef.current.addFile({
        name: file.name,
        type: file.type,
        data: file,
        meta: {
          libraryId,
          name: file.name,
          type: file.type || 'application/octet-stream',
        },
      })
    } catch (submitError) {
      setUploadError(submitError instanceof Error ? submitError.message : 'Upload failed.')
    } finally {
      event.target.value = ''
    }
  }

  const handleCancelLocalUpload = (uploadId: string) => {
    const uppy = uppyRef.current

    if (!uppy) {
      return
    }

    const file = uppy.getFile(uploadId)
    const tusUploadId =
      file?.tus?.uploadUrl?.split('/').pop() || localUploads[uploadId]?.tusUploadId || null

    setUploadError(null)
    cancelingUploadIdsRef.current.add(uploadId)

    setLocalUploads(current => {
      const existing = current[uploadId]

      if (!existing) {
        return current
      }

      return {
        ...current,
        [uploadId]: {
          ...existing,
          tusUploadId,
          status: 'CANCELLING',
          errorMessage: null,
          retryable: false,
          cancelRequestedAt: Date.now(),
          remoteCancelRequested: Boolean(tusUploadId),
        },
      }
    })

    uppy.removeFile(uploadId)
  }

  const handleRetryLocalUpload = async (uploadId: string) => {
    if (!uppyRef.current) {
      return
    }

    setUploadError(null)

    try {
      await uppyRef.current.retryUpload(uploadId)
      setLocalUploads(current => {
        const existing = current[uploadId]

        if (!existing) {
          return current
        }

        return {
          ...current,
          [uploadId]: {
            ...existing,
            status: 'UPLOADING',
            errorMessage: null,
            retryable: false,
            cancelRequestedAt: null,
            remoteCancelRequested: false,
          },
        }
      })
    } catch (retryError) {
      setUploadError(retryError instanceof Error ? retryError.message : 'Retry failed.')
    }
  }

  const handleCancelRemoteUpload = async (tusUploadId: string) => {
    setUploadError(null)

    try {
      await cancelTusUpload(tusUploadId)
      setUploads(await listUploads(libraryId))
    } catch (cancelError) {
      setUploadError(cancelError instanceof Error ? cancelError.message : 'Cancel failed.')
    }
  }

  return {
    documents,
    error,
    fileInputRef,
    handleCancelLocalUpload,
    handleCancelRemoteUpload,
    handleFileSelect,
    handleRetryLocalUpload,
    hasActiveUpload,
    isLoading,
    library,
    localUploads: localUploadList,
    uploadError,
    uploads,
  }
}
