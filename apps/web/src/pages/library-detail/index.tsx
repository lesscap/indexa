import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { DocumentsTable } from './documents-table'
import { LibraryHeader } from './library-header'
import { LibraryOverview } from './library-overview'
import { UploadPanel } from './upload-panel'
import { useLibraryDetail } from './use-library-detail'

export const LibraryDetailPage = () => {
  const { libraryId = '' } = useParams()
  const {
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
    localUploads,
    uploadCount,
    uploadError,
    uploads,
  } = useLibraryDetail(libraryId)

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
        <LibraryHeader
          library={library}
          fileInputRef={fileInputRef}
          hasActiveUpload={hasActiveUpload}
          onFileSelect={event => void handleFileSelect(event)}
        />

        {uploadError ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {uploadError}
          </div>
        ) : null}

        <UploadPanel
          uploads={uploads}
          localUploads={localUploads}
          onCancelLocalUpload={handleCancelLocalUpload}
          onRetryLocalUpload={upload => void handleRetryLocalUpload(upload)}
          onCancelRemoteUpload={upload => void handleCancelRemoteUpload(upload)}
        />

        <DocumentsTable documents={documents} />
      </section>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <LibraryOverview library={library} uploadCount={uploadCount} />
      </aside>
    </div>
  )
}
