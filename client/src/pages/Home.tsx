import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../hooks'

export default function Home() {
  const navigate = useNavigate()
  const {
    connectionStatus,
    error,
    clearError,
    roomCode,
    playerName: savedName,
    createRoom,
    joinRoom,
  } = useGame()

  const [name, setName] = useState(savedName || '')
  const [joinCode, setJoinCode] = useState('')

  // Navigate when room is created/joined
  useEffect(() => {
    if (roomCode) {
      navigate(`/room/${roomCode}`)
    }
  }, [roomCode, navigate])

  const handleCreate = () => {
    if (!name.trim()) return
    createRoom(name.trim())
  }

  const handleJoin = () => {
    if (!name.trim() || joinCode.length < 6) return
    joinRoom(joinCode.toUpperCase(), name.trim())
  }

  const isConnected = connectionStatus === 'connected'
  const isLoading = connectionStatus === 'connecting' || connectionStatus === 'reconnecting'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-wide text-paper sm:text-5xl">
            CODENAMES
          </h1>
        </div>

        {/* Connection status */}
        {!isConnected && (
          <div className={`rounded border p-3 text-center text-sm ${
            isLoading
              ? 'border-neutral/50 bg-neutral/10 text-neutral'
              : 'border-red-team/50 bg-red-team/10 text-red-team-light'
          }`}>
            {isLoading ? 'Connecting to server...' : 'Disconnected from server'}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center justify-between rounded border border-red-team/50 bg-red-team/10 p-3 text-sm text-red-team-light">
            <span>{error}</span>
            <button onClick={clearError} className="ml-2 hover:text-white">✕</button>
          </div>
        )}

        {/* Name input */}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-text-muted">
            YOUR NAME
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full rounded border border-border bg-bg-elevated px-4 py-3 text-text placeholder:text-text-muted focus:border-neutral focus:outline-none"
            maxLength={20}
          />
        </div>

        {/* Create Room Button */}
        <button
          onClick={handleCreate}
          disabled={!isConnected || !name.trim()}
          className="w-full rounded bg-red-team py-3 font-medium text-white transition-colors hover:bg-red-team-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          CREATE ROOM
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm text-text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Join Room Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="roomCode" className="block text-sm font-medium text-text-muted">
              ROOM CODE
            </label>
            <input
              id="roomCode"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-letter code"
              className="w-full rounded border border-border bg-bg-elevated px-4 py-3 text-center font-display text-xl sm:text-2xl tracking-widest text-text placeholder:text-text-muted placeholder:text-base placeholder:tracking-normal focus:border-neutral focus:outline-none"
              maxLength={6}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={!isConnected || !name.trim() || joinCode.length < 6}
            className="w-full rounded bg-blue-team py-3 font-medium text-white transition-colors hover:bg-blue-team-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            JOIN ROOM
          </button>

          {/* Validation messages */}
          {joinCode.length >= 1 && !name.trim() && (
            <div className="rounded border border-neutral/50 bg-neutral/10 p-2 text-center text-sm text-neutral">
              Please enter your name above to join a room
            </div>
          )}
          {name.trim() && joinCode.length > 0 && joinCode.length < 6 && (
            <div className="rounded border border-neutral/50 bg-neutral/10 p-2 text-center text-sm text-neutral">
              Room code must be 6 characters
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
