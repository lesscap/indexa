import { ArrowLeft, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  type ChunkNeighborsPayload,
  type DocumentChunksPayload,
  getChunkNeighbors,
  getDocumentChunks,
} from '@/lib/api'
import { formatBytes, formatDate, getDocumentStatusVariant } from '../library-detail/utils'

type NeighborsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; payload: ChunkNeighborsPayload }
  | { status: 'error'; message: string }

const initialNeighborsState: NeighborsState = { status: 'idle' }

export const DocumentDetailPage = () => {
  const { libraryId = '', documentId = '' } = useParams()
  const [data, setData] = useState<DocumentChunksPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [neighborsByChunk, setNeighborsByChunk] = useState<Record<number, NeighborsState>>({})

  useEffect(() => {
    if (!libraryId || !documentId) {
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getDocumentChunks(libraryId, documentId)
      .then(payload => {
        if (!cancelled) {
          setData(payload)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load document chunks.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, documentId])

  const handleToggleNeighbors = useCallback(
    async (chunkNo: number) => {
      const current = neighborsByChunk[chunkNo]
      if (current?.status === 'ready' || current?.status === 'loading') {
        // Toggle off if already showing or loading
        setNeighborsByChunk(prev => {
          const next = { ...prev }
          delete next[chunkNo]
          return next
        })
        return
      }
      setNeighborsByChunk(prev => ({ ...prev, [chunkNo]: { status: 'loading' } }))
      try {
        const payload = await getChunkNeighbors(libraryId, documentId, chunkNo)
        setNeighborsByChunk(prev => ({
          ...prev,
          [chunkNo]: { status: 'ready', payload },
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load neighbors.'
        setNeighborsByChunk(prev => ({ ...prev, [chunkNo]: { status: 'error', message } }))
      }
    },
    [libraryId, documentId, neighborsByChunk],
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-[1.75rem] border border-border bg-card/80">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
        {error || 'Document not found.'}
      </div>
    )
  }

  const { document, chunks } = data
  const status = document.currentIndexState?.status

  return (
    <div className="space-y-6">
      <Link
        to={`/libraries/${libraryId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </Link>

      <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Document
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{document.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{document.originalName}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(document.sizeBytes)}</span>
          <span aria-hidden="true">·</span>
          <span>Uploaded {formatDate(document.createdAt)}</span>
          <Badge variant={getDocumentStatusVariant(status)}>{status || 'UPLOADED'}</Badge>
        </div>
        {document.currentIndexState?.errorMessage ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {document.currentIndexState.errorMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Chunks ({chunks.length})</h2>
          {chunks.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              Click "Neighbors" to find similar chunks via the vector index
            </span>
          ) : null}
        </div>

        {chunks.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
            This document has not been indexed yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {chunks.map(chunk => {
              const neighbors = neighborsByChunk[chunk.chunkNo] ?? initialNeighborsState
              const isOpen = neighbors.status !== 'idle'
              return (
                <li
                  key={chunk.id}
                  className="rounded-[1.25rem] border border-border/80 bg-card/95 p-5 shadow-[0_8px_24px_rgba(24,51,35,0.04)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-semibold text-foreground">#{chunk.chunkNo}</span>
                      <span>{chunk.charCount} chars</span>
                      <span className="truncate" title={chunk.contentHash}>
                        sha:{chunk.contentHash.slice(0, 8)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleNeighbors(chunk.chunkNo)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {isOpen ? 'Hide neighbors' : 'Show neighbors'}
                    </Button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
                    {chunk.text || <span className="italic text-muted-foreground">(empty)</span>}
                  </pre>

                  {isOpen ? <NeighborsPanel state={neighbors} /> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

const NeighborsPanel = ({ state }: { state: NeighborsState }) => {
  if (state.status === 'loading') {
    return (
      <div className="mt-4 flex items-center gap-2 border-t border-dashed border-border/60 pt-4 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Looking up neighbors...
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="mt-4 border-t border-dashed border-border/60 pt-4 text-sm text-rose-700">
        {state.message}
      </div>
    )
  }
  if (state.status === 'ready') {
    if (state.payload.neighbors.length === 0) {
      return (
        <div className="mt-4 border-t border-dashed border-border/60 pt-4 text-sm text-muted-foreground">
          No neighbors returned by the vector index.
        </div>
      )
    }
    return (
      <div className="mt-4 space-y-3 border-t border-dashed border-border/60 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Neighbors
        </p>
        <ul className="space-y-2">
          {state.payload.neighbors.map(neighbor => (
            <li
              key={`${neighbor.documentId}-${neighbor.chunkNo}`}
              className="rounded-md border border-border/60 bg-muted/30 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-foreground">{neighbor.score.toFixed(3)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">
                    {neighbor.documentTitle} #{neighbor.chunkNo}
                  </span>
                </div>
                <span>{neighbor.charCount} chars</span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground">
                {neighbor.text || <span className="italic text-muted-foreground">(empty)</span>}
              </pre>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return null
}
