import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks'
import type { Team, TileColor, PublicWordTile, GameState, Clue } from '@shared/types'

export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const {
    connectionStatus,
    playerId,
    players,
    gameState,
    isSpymaster,
    submitClue,
    guessWord,
    endTurn,
    leaveRoom,
  } = useGame()

  // If no game state, show loading or redirect
  if (!gameState) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Loading game...</p>
      </main>
    )
  }

  const currentPlayer = players.find(p => p.id === playerId)
  const isMyTurn = currentPlayer?.team === gameState.turn.team
  const isCluePhase = gameState.phase === 'clue'
  const isGuessPhase = gameState.phase === 'guess'
  const isGameOver = gameState.phase === 'game_over'

  // Get remaining cards count
  const board = gameState.board
  const redRemaining = board.filter(t => !t.isRevealed && getTileColor(t, isSpymaster, gameState) === 'red').length
  const blueRemaining = board.filter(t => !t.isRevealed && getTileColor(t, isSpymaster, gameState) === 'blue').length

  const handleLeave = () => {
    leaveRoom()
    navigate('/')
  }

  return (
    <main className="flex min-h-screen flex-col p-2 sm:p-4">
      {/* Header */}
      <header className="mb-2 flex items-center justify-between sm:mb-4">
        <button
          onClick={handleLeave}
          className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:border-neutral hover:text-text sm:px-3 sm:py-1.5 sm:text-sm"
        >
          ← EXIT
        </button>
        <div className="text-center">
          <span className="font-display text-lg tracking-widest sm:text-xl">{roomCode}</span>
        </div>
        <div className="flex gap-2">
          <span className="rounded bg-red-team px-2 py-1 text-xs font-medium text-white sm:px-3 sm:text-sm">
            {redRemaining}
          </span>
          <span className="rounded bg-blue-team px-2 py-1 text-xs font-medium text-white sm:px-3 sm:text-sm">
            {blueRemaining}
          </span>
        </div>
      </header>

      {/* Connection warning */}
      {connectionStatus !== 'connected' && (
        <div className="mb-2 rounded border border-neutral/50 bg-neutral/10 p-2 text-center text-xs text-neutral">
          Reconnecting...
        </div>
      )}

      {/* Turn indicator */}
      <TurnIndicator
        team={gameState.turn.team}
        phase={gameState.phase}
        isMyTurn={isMyTurn}
        isSpymaster={isSpymaster}
        winner={gameState.winner}
      />

      {/* Game board - 5x5 grid */}
      <div className="mx-auto my-2 grid w-full max-w-2xl grid-cols-5 gap-1.5 sm:my-4 sm:gap-2">
        {board.map((tile) => (
          <WordCard
            key={tile.id}
            tile={tile}
            isSpymaster={isSpymaster}
            fullGameState={isSpymaster ? (gameState as GameState) : undefined}
            canGuess={isGuessPhase && isMyTurn && !isSpymaster && !tile.isRevealed}
            onGuess={() => guessWord(tile.id)}
          />
        ))}
      </div>

      {/* Clue display / input area */}
      <div className="mx-auto w-full max-w-md">
        {isGameOver ? (
          <GameOverModal winner={gameState.winner!} onPlayAgain={handleLeave} />
        ) : isCluePhase && isMyTurn && isSpymaster ? (
          <ClueInput team={gameState.turn.team} onSubmit={submitClue} />
        ) : (
          <ClueDisplay
            clue={gameState.turn.clue}
            guessesRemaining={gameState.turn.guessesRemaining}
            team={gameState.turn.team}
            showEndTurn={isGuessPhase && isMyTurn && !isSpymaster}
            onEndTurn={endTurn}
          />
        )}
      </div>
    </main>
  )
}

// Helper to get tile color (for spymaster view vs guesser view)
function getTileColor(
  tile: PublicWordTile,
  isSpymaster: boolean,
  gameState: GameState | { board: PublicWordTile[] }
): TileColor | undefined {
  if (tile.isRevealed) return tile.color
  if (isSpymaster && 'keyCard' in gameState) {
    const index = gameState.board.findIndex(t => t.id === tile.id)
    return gameState.keyCard.tiles[index]
  }
  return undefined
}

// Word Card Component
interface WordCardProps {
  tile: PublicWordTile
  isSpymaster: boolean
  fullGameState?: GameState
  canGuess: boolean
  onGuess: () => void
}

function WordCard({ tile, isSpymaster, fullGameState, canGuess, onGuess }: WordCardProps) {
  // Determine the color to show
  let displayColor: TileColor | undefined
  if (tile.isRevealed) {
    displayColor = tile.color
  } else if (isSpymaster && fullGameState) {
    const index = fullGameState.board.findIndex(t => t.id === tile.id)
    displayColor = fullGameState.keyCard.tiles[index]
  }

  const colorClasses: Record<TileColor, string> = {
    red: 'bg-red-team text-white',
    blue: 'bg-blue-team text-white',
    neutral: 'bg-neutral text-ink',
    assassin: 'bg-assassin text-white',
  }

  const spymasterBorderClasses: Record<TileColor, string> = {
    red: 'border-red-team',
    blue: 'border-blue-team',
    neutral: 'border-neutral',
    assassin: 'border-assassin',
  }

  const isRevealed = tile.isRevealed
  const baseClasses = 'relative aspect-[4/3] rounded border-2 p-1 text-center transition-all sm:aspect-[3/2] sm:p-2'

  if (isRevealed && displayColor) {
    // Revealed card
    return (
      <div className={`${baseClasses} ${colorClasses[displayColor]} border-transparent opacity-90`}>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium line-through opacity-70 sm:text-xs">
          {tile.word}
        </span>
      </div>
    )
  }

  if (isSpymaster && displayColor) {
    // Spymaster view - unrevealed but shows color hint
    return (
      <div className={`${baseClasses} ${spymasterBorderClasses[displayColor]} border-4 bg-card-unrevealed`}>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-ink sm:text-xs">
          {tile.word}
        </span>
      </div>
    )
  }

  // Normal unrevealed card (guesser view)
  return (
    <button
      onClick={canGuess ? onGuess : undefined}
      disabled={!canGuess}
      className={`${baseClasses} border-border bg-card-unrevealed ${
        canGuess
          ? 'cursor-pointer hover:scale-105 hover:border-neutral hover:shadow-card-hover active:scale-100'
          : 'cursor-default'
      }`}
    >
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-ink sm:text-xs">
        {tile.word}
      </span>
    </button>
  )
}

// Turn Indicator Component
interface TurnIndicatorProps {
  team: Team
  phase: string
  isMyTurn: boolean
  isSpymaster: boolean
  winner?: Team
}

function TurnIndicator({ team, phase, isMyTurn, isSpymaster, winner }: TurnIndicatorProps) {
  if (winner) {
    const winnerLabel = winner === 'red' ? 'RED' : 'BLUE'
    const winnerColor = winner === 'red' ? 'text-red-team' : 'text-blue-team'
    return (
      <div className="rounded bg-bg-elevated p-3 text-center">
        <p className={`font-display text-lg ${winnerColor}`}>{winnerLabel} TEAM WINS!</p>
      </div>
    )
  }

  const teamLabel = team === 'red' ? 'RED' : 'BLUE'
  const teamBg = team === 'red' ? 'bg-red-team/20' : 'bg-blue-team/20'
  const teamColor = team === 'red' ? 'text-red-team' : 'text-blue-team'

  let phaseText = ''
  if (phase === 'clue') {
    phaseText = isMyTurn && isSpymaster ? 'YOUR TURN - GIVE A CLUE' : 'SPYMASTER GIVING CLUE'
  } else if (phase === 'guess') {
    phaseText = isMyTurn && !isSpymaster ? 'YOUR TURN - GUESS' : 'OPERATIVES GUESSING'
  }

  return (
    <div className={`rounded ${teamBg} p-2 text-center sm:p-3`}>
      <p className={`font-display text-sm sm:text-lg ${teamColor}`}>
        {teamLabel} TEAM • {phaseText}
      </p>
      {isMyTurn && (
        <p className="mt-1 text-xs text-text-muted">It's your turn!</p>
      )}
    </div>
  )
}

// Clue Input Component
interface ClueInputProps {
  team: Team
  onSubmit: (word: string, count: number) => void
}

function ClueInput({ team, onSubmit }: ClueInputProps) {
  const [word, setWord] = useState('')
  const [count, setCount] = useState(1)

  const handleSubmit = () => {
    if (word.trim() && count >= 0) {
      onSubmit(word.trim().toUpperCase(), count)
      setWord('')
      setCount(1)
    }
  }

  const teamColor = team === 'red' ? 'border-red-team' : 'border-blue-team'
  const buttonColor = team === 'red' ? 'bg-red-team hover:bg-red-team-light' : 'bg-blue-team hover:bg-blue-team-light'

  return (
    <div className={`rounded border-2 ${teamColor} bg-bg-elevated p-4`}>
      <p className="mb-3 text-center text-sm text-text-muted">ENTER YOUR CLUE</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value.replace(/[^a-zA-Z]/g, ''))}
          placeholder="One word clue"
          className="flex-1 rounded border border-border bg-bg px-3 py-2 text-center font-display text-lg uppercase tracking-wide text-text placeholder:text-text-muted placeholder:normal-case placeholder:text-sm focus:border-neutral focus:outline-none"
          maxLength={20}
        />
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-16 rounded border border-border bg-bg px-2 py-2 text-center text-text focus:border-neutral focus:outline-none"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <option key={n} value={n}>{n === 0 ? '∞' : n}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!word.trim()}
        className={`mt-3 w-full rounded ${buttonColor} py-2 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
      >
        SUBMIT CLUE
      </button>
    </div>
  )
}

// Clue Display Component
interface ClueDisplayProps {
  clue?: Clue
  guessesRemaining: number
  team: Team
  showEndTurn: boolean
  onEndTurn: () => void
}

function ClueDisplay({ clue, guessesRemaining, team, showEndTurn, onEndTurn }: ClueDisplayProps) {
  const teamColor = team === 'red' ? 'border-red-team' : 'border-blue-team'

  if (!clue) {
    return (
      <div className="rounded border border-border bg-bg-elevated p-4 text-center">
        <p className="text-text-muted">Waiting for clue...</p>
      </div>
    )
  }

  return (
    <div className={`rounded border-2 ${teamColor} bg-bg-elevated p-4`}>
      <p className="mb-1 text-center text-xs text-text-muted">CURRENT CLUE</p>
      <p className="text-center font-display text-2xl tracking-wide">
        {clue.word} <span className="text-neutral">{clue.count === 0 ? '∞' : clue.count}</span>
      </p>
      <p className="mt-2 text-center text-xs text-text-muted">
        {guessesRemaining} guess{guessesRemaining !== 1 ? 'es' : ''} remaining
      </p>
      {showEndTurn && (
        <button
          onClick={onEndTurn}
          className="mt-3 w-full rounded border border-border bg-transparent py-2 text-sm text-text hover:border-neutral"
        >
          END TURN
        </button>
      )}
    </div>
  )
}

// Game Over Modal Component
interface GameOverModalProps {
  winner: Team
  onPlayAgain: () => void
}

function GameOverModal({ winner, onPlayAgain }: GameOverModalProps) {
  const winnerLabel = winner === 'red' ? 'RED' : 'BLUE'
  const winnerColor = winner === 'red' ? 'text-red-team' : 'text-blue-team'
  const winnerBg = winner === 'red' ? 'border-red-team' : 'border-blue-team'

  return (
    <div className={`rounded border-2 ${winnerBg} bg-bg-elevated p-6 text-center`}>
      <p className="text-sm text-text-muted">OPERATION COMPLETE</p>
      <h2 className={`mt-2 font-display text-3xl ${winnerColor}`}>{winnerLabel} TEAM WINS!</h2>
      <button
        onClick={onPlayAgain}
        className="mt-4 rounded bg-neutral px-6 py-2 font-medium text-ink hover:bg-neutral-light"
      >
        RETURN TO LOBBY
      </button>
    </div>
  )
}
