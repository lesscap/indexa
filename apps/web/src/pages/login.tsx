import { startTransition, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isResolved, login } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isResolved && session) {
    return <Navigate to="/libraries" replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await login(username, password)
      const nextPath =
        typeof location.state === 'object' && location.state && 'from' in location.state
          ? String(location.state.from)
          : '/libraries'

      startTransition(() => {
        navigate(nextPath, { replace: true })
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-[28rem] rounded-[2rem] border border-border/80 bg-card/95 p-8 shadow-[0_24px_80px_rgba(24,51,35,0.08)]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Indexa Console
          </p>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Console Login</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in to manage libraries and upload documents for the current domain.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2" htmlFor="username">
            <span className="text-sm font-medium text-foreground">Username</span>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="admin"
            />
          </label>

          <label className="block space-y-2" htmlFor="password">
            <span className="text-sm font-medium text-foreground">Password</span>
            <Input
              id="password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <Button className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
