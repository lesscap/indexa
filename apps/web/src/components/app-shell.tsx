import { Database, Sparkles } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export const AppShell = () => {
  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-[0_24px_80px_rgba(24,51,35,0.08)] backdrop-blur md:p-8">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Knowledge Infrastructure
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Indexa Control Plane
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Monorepo scaffold for a SyncChat-style knowledge base system, with a React console
                and Fastify backend ready for domain modules.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="lg">
            <Link to="/knowledge-bases">
              <Database className="mr-2 h-4 w-4" />
              Knowledge Bases
            </Link>
          </Button>
        </header>

        <main className="flex-1 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
