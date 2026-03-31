import { ArrowLeft, FileUp, FolderOpen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  type DocumentSummary,
  getLibrary,
  type LibraryDetail,
  listDocuments,
  uploadDocument,
} from '@/lib/api'

const formatBytes = (value: string) => {
  const size = Number(value)

  if (!Number.isFinite(size)) {
    return value
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let current = size
  let unitIndex = 0

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }

  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const getStatusVariant = (status: string | null | undefined) => {
  switch (status) {
    case 'READY':
      return 'success'
    case 'FAILED':
      return 'danger'
    case 'PROCESSING':
      return 'warning'
    default:
      return 'neutral'
  }
}

export const LibraryDetailPage = () => {
  const { libraryId = '' } = useParams()
  const [library, setLibrary] = useState<LibraryDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const documentCount = useMemo(() => documents.length, [documents])

  useEffect(() => {
    const load = async () => {
      try {
        const [nextLibrary, nextDocuments] = await Promise.all([
          getLibrary(libraryId),
          listDocuments(libraryId),
        ])

        setLibrary(nextLibrary)
        setDocuments(nextDocuments)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load library.')
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [libraryId])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      await uploadDocument(libraryId, file)
      setDocuments(await listDocuments(libraryId))
    } catch (submitError) {
      setUploadError(submitError instanceof Error ? submitError.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-[1.75rem] border border-border bg-card/80">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error || !library) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
        {error || 'Library not found.'}
      </div>
    )
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_22rem]">
      <section className="space-y-6">
        <div className="space-y-4">
          <Link
            to="/libraries"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Libraries
          </Link>

          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)] md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Library Workspace
              </p>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{library.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {library.description || 'No description yet.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                onChange={handleFileSelect}
              />
              <Button
                size="lg"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </div>
        </div>

        {uploadError ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {uploadError}
          </div>
        ) : null}

        <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
          <div className="flex flex-col gap-3 border-b border-border/80 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Documents
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Library Documents</h2>
            </div>
            <Badge variant="neutral">{documentCount} files</Badge>
          </div>

          {documents.length === 0 ? (
            <div className="flex min-h-[14rem] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="rounded-3xl bg-primary/10 p-4 text-primary">
                <FolderOpen className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold tracking-tight">No documents yet</h3>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  Upload the first document to queue indexing for this library.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border/80">
              <table className="min-w-full divide-y divide-border text-left text-sm">
                <thead className="bg-secondary/70 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Document</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Uploaded</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {documents.map(document => (
                    <tr key={document.id}>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">{document.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {document.originalName}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatBytes(document.sizeBytes)}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDate(document.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={getStatusVariant(document.currentIndexState?.status)}>
                          {document.currentIndexState?.status || 'UPLOADED'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Overview
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="mt-1 font-medium text-foreground">{library.slug}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Documents</dt>
              <dd className="mt-1 font-medium text-foreground">{library.documentCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active Index</dt>
              <dd className="mt-1 font-medium text-foreground">
                {library.activeIndex ? `v${library.activeIndex.version}` : 'Not ready'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Embedding Method</dt>
              <dd className="mt-1 font-medium text-foreground">
                {library.activeIndex?.embeddingMethod.name || 'No active embedding method'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1 font-medium text-foreground">{formatDate(library.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  )
}
