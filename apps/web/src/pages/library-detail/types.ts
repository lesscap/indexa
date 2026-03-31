export type LocalUploadStatus = 'UPLOADING' | 'FAILED' | 'CANCELLING'

export type LocalUpload = {
  id: string
  tusUploadId: string | null
  name: string
  mimeType: string
  sizeBytes: number
  bytesReceived: number
  status: LocalUploadStatus
  errorMessage: string | null
  retryable: boolean
  cancelRequestedAt: number | null
  remoteCancelRequested: boolean
}
