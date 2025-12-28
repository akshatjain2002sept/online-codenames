import { createContext, useContext, type ReactNode } from 'react'
import { useGameState } from './useGameState'

// Get WebSocket URL from environment or auto-detect from the current host.
const WS_URL = (() => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  return `${protocol}//${host}:3001/ws`
})()

type GameContextType = ReturnType<typeof useGameState>

const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const gameState = useGameState({ serverUrl: WS_URL })

  return (
    <GameContext.Provider value={gameState}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
