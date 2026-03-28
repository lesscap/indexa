import { ArrowRight, Boxes, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'

const milestones = [
  'Workspace is organized for separate frontend and backend delivery.',
  'Fastify routes are split by domain so services can grow without a flat server file.',
  'Tailwind and shadcn/ui are wired in for internal console development.',
]

export const KnowledgeBasesPage = () => {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
      <section className="rounded-[1.75rem] border border-border bg-secondary/40 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Ready For Domain Work
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Knowledge Bases</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              The project is initialized. Next steps can layer in connectors, ingestion, retrieval,
              indexing, and tenant-aware knowledge management on top of this shell.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-primary shadow-sm">
            <Boxes className="h-7 w-7" />
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          {milestones.map(item => (
            <div
              key={item}
              className="rounded-2xl border border-border/80 bg-card px-4 py-4 text-sm text-card-foreground"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg">Create First Knowledge Base</Button>
          <Button asChild size="lg" variant="outline">
            <a href="/api/health">
              Check API Health
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      <aside className="rounded-[1.75rem] border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Backend Status</p>
            <p className="text-lg font-semibold">Fastify skeleton ready</p>
          </div>
        </div>

        <dl className="mt-8 space-y-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Dev API
            </dt>
            <dd className="mt-2 font-mono text-sm text-card-foreground">http://127.0.0.1:4110</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Health Route
            </dt>
            <dd className="mt-2 font-mono text-sm text-card-foreground">GET /api/health</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Placeholder Route
            </dt>
            <dd className="mt-2 font-mono text-sm text-card-foreground">
              GET /api/knowledge-bases
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  )
}
