import { FolderOpen } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import type { DocumentSummary } from '@/lib/api'
import { formatBytes, formatDate, getDocumentStatusVariant } from './utils'

type DocumentsTableProps = {
  documents: DocumentSummary[]
}

export const DocumentsTable = ({ documents }: DocumentsTableProps) => {
  const { libraryId = '' } = useParams()
  const navigate = useNavigate()
  return (
    <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
      <div className="flex flex-col gap-3 border-b border-border/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Documents
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Library Documents</h2>
        </div>
        <Badge variant="neutral">{documents.length} files</Badge>
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
                <tr
                  key={document.id}
                  className="cursor-pointer transition hover:bg-secondary/40"
                  onClick={() => navigate(`/libraries/${libraryId}/documents/${document.id}`)}
                >
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-foreground">{document.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{document.originalName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatBytes(document.sizeBytes)}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDate(document.createdAt)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={getDocumentStatusVariant(document.currentIndexState?.status)}>
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
  )
}
