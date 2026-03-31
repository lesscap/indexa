import { ArrowLeft, FileUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { LibraryDetail } from '@/lib/api'

type LibraryHeaderProps = {
  library: LibraryDetail
  fileInputRef: React.RefObject<HTMLInputElement | null>
  hasActiveUpload: boolean
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export const LibraryHeader = ({
  library,
  fileInputRef,
  hasActiveUpload,
  onFileSelect,
}: LibraryHeaderProps) => {
  return (
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
          <input ref={fileInputRef} className="hidden" type="file" onChange={onFileSelect} />
          <Button
            size="lg"
            disabled={hasActiveUpload}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="mr-2 h-4 w-4" />
            {hasActiveUpload ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>
      </div>
    </div>
  )
}
