import { RotateCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { UploadSessionSummary } from '@/lib/api'
import type { LocalUpload } from './types'
import {
  formatBytes,
  formatDate,
  getLocalUploadProgress,
  getRemoteUploadProgress,
  getUploadStatusVariant,
} from './utils'

type UploadPanelProps = {
  uploads: UploadSessionSummary[]
  localUploads: LocalUpload[]
  onCancelLocalUpload: (uploadId: string) => void
  onRetryLocalUpload: (uploadId: string) => void
  onCancelRemoteUpload: (tusUploadId: string) => void
}

const LocalUploadItem = ({
  upload,
  onCancel,
  onRetry,
}: {
  upload: LocalUpload
  onCancel: (uploadId: string) => void
  onRetry: (uploadId: string) => void
}) => {
  return (
    <div className="rounded-[1.25rem] border border-border/80 bg-secondary/40 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{upload.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatBytes(upload.bytesReceived)} / {formatBytes(upload.sizeBytes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getUploadStatusVariant(upload.status)}>{upload.status}</Badge>
          {upload.status === 'UPLOADING' ? (
            <Button variant="ghost" size="icon" onClick={() => onCancel(upload.id)}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
          {upload.status === 'CANCELLING' ? (
            <Button variant="ghost" size="icon" disabled>
              <Spinner className="h-4 w-4" />
            </Button>
          ) : null}
          {upload.status === 'FAILED' && upload.retryable ? (
            <Button variant="ghost" size="icon" onClick={() => onRetry(upload.id)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${getLocalUploadProgress(upload)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{getLocalUploadProgress(upload)}%</span>
          <span>
            {upload.status === 'FAILED'
              ? 'Upload failed'
              : upload.status === 'CANCELLING'
                ? 'Cancelling...'
                : 'Uploading'}
          </span>
        </div>
        {upload.errorMessage ? (
          <p className="mt-3 text-sm text-rose-700">{upload.errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}

const RemoteUploadItem = ({
  upload,
  onCancel,
}: {
  upload: UploadSessionSummary
  onCancel: (tusUploadId: string) => void
}) => {
  return (
    <div className="rounded-[1.25rem] border border-border/80 bg-secondary/40 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{upload.originalName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatBytes(upload.bytesReceived)} / {formatBytes(upload.sizeBytes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getUploadStatusVariant(upload.status)}>{upload.status}</Badge>
          {(upload.status === 'CREATED' || upload.status === 'UPLOADING') && upload.tusUploadId ? (
            <Button variant="ghost" size="icon" onClick={() => onCancel(upload.tusUploadId)}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${getRemoteUploadProgress(upload)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{getRemoteUploadProgress(upload)}%</span>
          <span>{formatDate(upload.updatedAt)}</span>
        </div>
        {upload.errorMessage ? (
          <p className="mt-3 text-sm text-rose-700">{upload.errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}

export const UploadPanel = ({
  uploads,
  localUploads,
  onCancelLocalUpload,
  onRetryLocalUpload,
  onCancelRemoteUpload,
}: UploadPanelProps) => {
  const hasLocalUpload = localUploads.length > 0
  const uploadCount = hasLocalUpload ? localUploads.length : uploads.length

  if (uploadCount === 0) {
    return null
  }

  return (
    <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
      <div className="flex items-center justify-between pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Active Uploads
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">In progress</h2>
        </div>
        <Badge variant="neutral">{uploadCount}</Badge>
      </div>

      <div className="space-y-3">
        {hasLocalUpload
          ? localUploads.map(upload => (
              <LocalUploadItem
                key={upload.id}
                upload={upload}
                onCancel={onCancelLocalUpload}
                onRetry={onRetryLocalUpload}
              />
            ))
          : uploads.map(upload => (
              <RemoteUploadItem key={upload.id} upload={upload} onCancel={onCancelRemoteUpload} />
            ))}
      </div>
    </div>
  )
}
