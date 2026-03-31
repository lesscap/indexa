import {
  createContext,
  type ReactNode,
  startTransition,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  type ConsoleSession,
  getConsoleSession,
  loginToConsole,
  logoutFromConsole,
} from '@/lib/api'

type SessionContextValue = {
  session: ConsoleSession | null
  isResolved: boolean
  login: (username: string, password: string) => Promise<ConsoleSession>
  logout: () => Promise<void>
  refresh: () => Promise<ConsoleSession | null>
}

type SessionProviderProps = {
  children: ReactNode
  bootstrap?: {
    session: ConsoleSession | null
    resolved: boolean
  }
}

const SessionContext = createContext<SessionContextValue | null>(null)

export const SessionProvider = ({ children, bootstrap }: SessionProviderProps) => {
  const [session, setSession] = useState<ConsoleSession | null>(bootstrap?.session ?? null)
  const [isResolved, setIsResolved] = useState(bootstrap?.resolved ?? false)

  const refresh = async () => {
    const nextSession = await getConsoleSession()

    startTransition(() => {
      setSession(nextSession)
      setIsResolved(true)
    })

    return nextSession
  }

  useEffect(() => {
    if (bootstrap) {
      return
    }

    let active = true

    void getConsoleSession().then(nextSession => {
      if (!active) {
        return
      }

      startTransition(() => {
        setSession(nextSession)
        setIsResolved(true)
      })
    })

    return () => {
      active = false
    }
  }, [bootstrap])

  const login = async (username: string, password: string) => {
    const nextSession = await loginToConsole(username, password)

    startTransition(() => {
      setSession(nextSession)
      setIsResolved(true)
    })

    return nextSession
  }

  const logout = async () => {
    await logoutFromConsole()

    startTransition(() => {
      setSession(null)
      setIsResolved(true)
    })
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        isResolved,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider')
  }

  return context
}
