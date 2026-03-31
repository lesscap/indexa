import type { UploadSessionSummary } from '@/lib/api'
import type { LocalUpload } from './types'

export const formatBytes = (value: string | number) => {
  const size = Number(value)

  if (!Number.isFinite(size)) {
    return String(value)
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

export const formatDate = (value: string) => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const getDocumentStatusVariant = (status: string | null | undefined) => {
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

export const getUploadStatusVariant = (status: string) => {
  switch (status) {
    case 'FAILED':
      return 'danger'
    case 'CANCELLING':
      return 'neutral'
    default:
      return 'warning'
  }
}

export const getRemoteUploadProgress = (upload: UploadSessionSummary) => {
  const total = Number(upload.sizeBytes)
  const received = Number(upload.bytesReceived)

  if (!Number.isFinite(total) || total <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((received / total) * 100)))
}

export const getLocalUploadProgress = (upload: LocalUpload) => {
  if (upload.sizeBytes <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((upload.bytesReceived / upload.sizeBytes) * 100)))
}

export const hasLiveRemoteUpload = (uploads: UploadSessionSummary[]) => {
  return uploads.some(upload => upload.status === 'CREATED' || upload.status === 'UPLOADING')
}
