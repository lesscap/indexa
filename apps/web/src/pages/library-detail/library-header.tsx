import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LibraryDetail } from '@/lib/api'
import { formatDate } from './utils'

type LibraryHeaderProps = {
  library: LibraryDetail
}

export const LibraryHeader = ({ library }: LibraryHeaderProps) => {
  const metadata = [
    library.slug,
    `${library.documentCount} ${library.documentCount === 1 ? 'doc' : 'docs'}`,
    library.activeIndex?.embeddingMethod.name ?? 'No embedding method',
    library.activeIndex ? `index v${library.activeIndex.version}` : 'no active index',
    `created ${formatDate(library.createdAt)}`,
  ]

  return (
    <div className="space-y-4">
      <Link
        to="/libraries"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Libraries
      </Link>

      <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Library Workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{library.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {library.description || 'No description yet.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {metadata.map((item, index) => (
            <span key={item} className="flex items-center gap-3">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              <span>{item}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
