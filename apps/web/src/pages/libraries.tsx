import { Plus, Sparkles } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createLibrary, type LibrarySummary, listLibraries } from '@/lib/api'

export const LibrariesPage = () => {
  const navigate = useNavigate()
  const [libraries, setLibraries] = useState<LibrarySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const skeletonKeys = ['skeleton-a', 'skeleton-b', 'skeleton-c', 'skeleton-d']

  useEffect(() => {
    const load = async () => {
      try {
        setLibraries(await listLibraries())
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load libraries.')
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setCreateError(null)

    try {
      const library = await createLibrary({
        name,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      })

      startTransition(() => {
        navigate(`/libraries/${library.id}`)
      })
    } catch (submitError) {
      setCreateError(
        submitError instanceof Error ? submitError.message : 'Failed to create library.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_22rem]">
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Libraries
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Knowledge Libraries</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Choose a library to manage its documents, or create a new one for a fresh corpus.
              </p>
            </div>
          </div>
          <Badge variant="neutral">{libraries.length} total</Badge>
        </div>

        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            skeletonKeys.map(key => (
              <div key={key} className="h-44 rounded-[1.75rem] border border-border bg-card/70" />
            ))
          ) : libraries.length > 0 ? (
            libraries.map(library => (
              <Link
                key={library.id}
                to={`/libraries/${library.id}`}
                className="group rounded-[1.75rem] border border-border/80 bg-card/95 p-6 transition hover:border-primary/35 hover:shadow-[0_18px_48px_rgba(24,51,35,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <Badge variant="neutral">
                    {library.activeIndex?.embeddingMethod.name ?? 'No Index'}
                  </Badge>
                </div>

                <div className="mt-5">
                  <h2 className="text-xl font-semibold tracking-tight transition group-hover:text-primary">
                    {library.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {library.description || 'No description yet.'}
                  </p>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-secondary/70 px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Slug
                    </dt>
                    <dd className="mt-2 font-medium text-foreground">{library.slug}</dd>
                  </div>
                  <div className="rounded-2xl bg-secondary/70 px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Index
                    </dt>
                    <dd className="mt-2 font-medium text-foreground">
                      v{library.activeIndex?.version ?? '-'}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-card/70 p-8 md:col-span-2">
              <div className="max-w-xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Empty State
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">Create your first library</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Libraries group the documents that belong to one knowledge base. Start with a
                  name, keep the default embedding method, and upload documents after creation.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-[0_18px_48px_rgba(24,51,35,0.06)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              New Library
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Create Library</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              v1 uses the default embedding method for the current domain.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2" htmlFor="library-name">
              <span className="text-sm font-medium">Name</span>
              <Input
                id="library-name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Policy Archive"
              />
            </label>

            <label className="block space-y-2" htmlFor="library-slug">
              <span className="text-sm font-medium">Slug</span>
              <Input
                id="library-slug"
                value={slug}
                onChange={event => setSlug(event.target.value)}
                placeholder="policy-archive"
              />
            </label>

            <label className="block space-y-2" htmlFor="library-description">
              <span className="text-sm font-medium">Description</span>
              <Textarea
                id="library-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Internal policies and reference documents."
              />
            </label>

            <div className="rounded-2xl border border-border bg-secondary/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Embedding Method
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Qwen Text Embedding V3</p>
            </div>

            {createError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {createError}
              </div>
            ) : null}

            <Button className="w-full" disabled={isSubmitting || !name.trim()} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Creating...' : 'Create Library'}
            </Button>
          </form>
        </div>
      </aside>
    </div>
  )
}
