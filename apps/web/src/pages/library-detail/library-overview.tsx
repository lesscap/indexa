import type { LibraryDetail } from '@/lib/api'
import { formatDate } from './utils'

type LibraryOverviewProps = {
  library: LibraryDetail
  uploadCount: number
}

export const LibraryOverview = ({ library, uploadCount }: LibraryOverviewProps) => {
  return (
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
          <dt className="text-muted-foreground">Active Uploads</dt>
          <dd className="mt-1 font-medium text-foreground">{uploadCount}</dd>
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
  )
}
