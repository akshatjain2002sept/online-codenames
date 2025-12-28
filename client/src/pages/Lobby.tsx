import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks'
import type { Player, Team, Role } from '@shared/types'

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const {
    connectionStatus,
    playerId,
    players,
    gameState,
    setTeam,
    setRole,
    startGame,
    leaveRoom,
  } = useGame()

  // Redirect to game when it starts
  useEffect(() => {
    if (gameState?.phase === 'clue' || gameState?.phase === 'guess') {
      navigate(`/room/${roomCode}/game`)
    }
  }, [gameState?.phase, roomCode, navigate])

  // Current player
  const currentPlayer = players.find(p => p.id === playerId)
  const isHost = currentPlayer?.isHost ?? false

  // Group players by team
  const redTeam = players.filter(p => p.team === 'red')
  const blueTeam = players.filter(p => p.team === 'blue')
  const unassigned = players.filter(p => !p.team)

  // Check if game can start
  const redSpymaster = redTeam.find(p => p.role === 'spymaster')
  const blueSpymaster = blueTeam.find(p => p.role === 'spymaster')
  const redGuessers = redTeam.filter(p => p.role === 'guesser')
  const blueGuessers = blueTeam.filter(p => p.role === 'guesser')
  const canStart = redSpymaster && blueSpymaster && redGuessers.length > 0 && blueGuessers.length > 0

  const handleLeave = () => {
    leaveRoom()
    navigate('/')
  }

  return (
    <main className="flex min-h-screen flex-col p-4">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <button
          onClick={handleLeave}
          className="rounded border border-border px-3 py-1.5 text-sm text-text-muted hover:border-neutral hover:text-text"
        >
          ← LEAVE
        </button>
        <div className="text-center">
          <p className="text-xs text-text-muted">OPERATION</p>
          <h1 className="font-display text-2xl tracking-widest text-paper">{roomCode}</h1>
        </div>
        <div className="w-[70px]" /> {/* Spacer for centering */}
      </header>

      {/* Connection status */}
      {connectionStatus !== 'connected' && (
        <div className="mb-4 rounded border border-neutral/50 bg-neutral/10 p-2 text-center text-sm text-neutral">
          Reconnecting...
        </div>
      )}

      {/* Team selection grid */}
      <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-2">
        {/* Red Team */}
        <TeamPanel
          team="red"
          players={redTeam}
          currentPlayerId={playerId}
          currentPlayerTeam={currentPlayer?.team}
          onJoinTeam={() => setTeam('red')}
          onSetRole={setRole}
        />

        {/* Blue Team */}
        <TeamPanel
          team="blue"
          players={blueTeam}
          currentPlayerId={playerId}
          currentPlayerTeam={currentPlayer?.team}
          onJoinTeam={() => setTeam('blue')}
          onSetRole={setRole}
        />
      </div>

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <div className="mx-auto mt-6 w-full max-w-4xl">
          <h3 className="mb-2 text-sm text-text-muted">AWAITING ASSIGNMENT</h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(player => (
              <span
                key={player.id}
                className={`rounded border border-border px-3 py-1 text-sm ${
                  player.id === playerId ? 'bg-bg-elevated text-text' : 'text-text-muted'
                }`}
              >
                {player.name}
                {player.isHost && ' ★'}
                {!player.isConnected && ' (offline)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Start game button */}
      <div className="mx-auto mt-8 text-center">
        {isHost ? (
          <>
            <button
              onClick={startGame}
              disabled={!canStart}
              className="rounded bg-neutral px-8 py-3 font-medium text-ink transition-colors hover:bg-neutral-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              START OPERATION
            </button>
            {!canStart && (
              <p className="mt-2 text-xs text-text-muted">
                Need spymaster + guesser on each team
              </p>
            )}
          </>
        ) : (
          <p className="text-text-muted">
            Waiting for host to start...
          </p>
        )}
      </div>
    </main>
  )
}

interface TeamPanelProps {
  team: Team
  players: Player[]
  currentPlayerId: string | null
  currentPlayerTeam?: Team
  onJoinTeam: () => void
  onSetRole: (role: Role) => void
}

function TeamPanel({
  team,
  players,
  currentPlayerId,
  currentPlayerTeam,
  onJoinTeam,
  onSetRole,
}: TeamPanelProps) {
  const isRed = team === 'red'
  const teamColor = isRed ? 'red-team' : 'blue-team'
  const teamLabel = isRed ? 'RED' : 'BLUE'

  const spymaster = players.find(p => p.role === 'spymaster')
  const guessers = players.filter(p => p.role === 'guesser')

  const isOnThisTeam = currentPlayerTeam === team
  const currentPlayer = players.find(p => p.id === currentPlayerId)

  return (
    <div className={`rounded-lg border-2 border-${teamColor} bg-bg-elevated p-4`}>
      <h2 className={`mb-4 font-display text-xl text-${teamColor}`}>{teamLabel} TEAM</h2>

      {/* Spymaster slot */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs text-text-muted">SPYMASTER</h3>
        {spymaster ? (
          <div className={`rounded border border-${teamColor}/50 bg-${teamColor}/10 px-3 py-2`}>
            <span className={`text-${teamColor}-light`}>
              {spymaster.name}
              {spymaster.id === currentPlayerId && ' (you)'}
              {spymaster.isHost && ' ★'}
            </span>
          </div>
        ) : isOnThisTeam ? (
          <button
            onClick={() => onSetRole('spymaster')}
            className={`w-full rounded border border-${teamColor}/50 border-dashed px-3 py-2 text-${teamColor}/70 hover:border-${teamColor} hover:text-${teamColor}`}
          >
            + Become Spymaster
          </button>
        ) : (
          <div className="rounded border border-border/50 border-dashed px-3 py-2 text-text-muted">
            Empty
          </div>
        )}
      </div>

      {/* Guessers */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs text-text-muted">OPERATIVES</h3>
        <div className="space-y-1">
          {guessers.map(player => (
            <div
              key={player.id}
              className={`rounded border border-${teamColor}/30 px-3 py-1.5 text-sm`}
            >
              {player.name}
              {player.id === currentPlayerId && ' (you)'}
              {player.isHost && ' ★'}
              {!player.isConnected && ' (offline)'}
            </div>
          ))}
          {isOnThisTeam && currentPlayer?.role !== 'guesser' && (
            <button
              onClick={() => onSetRole('guesser')}
              className={`w-full rounded border border-${teamColor}/50 border-dashed px-3 py-1.5 text-sm text-${teamColor}/70 hover:border-${teamColor} hover:text-${teamColor}`}
            >
              + Become Operative
            </button>
          )}
          {guessers.length === 0 && !isOnThisTeam && (
            <div className="rounded border border-border/50 border-dashed px-3 py-1.5 text-sm text-text-muted">
              No operatives yet
            </div>
          )}
        </div>
      </div>

      {/* Join team button */}
      {!isOnThisTeam && (
        <button
          onClick={onJoinTeam}
          className={`w-full rounded border border-${teamColor} bg-transparent py-2 text-${teamColor} transition-colors hover:bg-${teamColor} hover:text-white`}
        >
          JOIN {teamLabel}
        </button>
      )}
    </div>
  )
}
