import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

type UploadCardProps = {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  hasActiveUpload: boolean
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export const UploadCard = ({ fileInputRef, hasActiveUpload, onFileSelect }: UploadCardProps) => {
  return (
    <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        Upload
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Add a document</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Pick a file to start a resumable upload. Indexing kicks off automatically once it lands.
      </p>
      <input ref={fileInputRef} className="hidden" type="file" onChange={onFileSelect} />
      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={hasActiveUpload}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="mr-2 h-4 w-4" />
        {hasActiveUpload ? 'Uploading...' : 'Choose file'}
      </Button>
    </div>
  )
}
