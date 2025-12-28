import { useCallback, useState } from 'react'
import { useWebSocket, type ConnectionStatus } from './useWebSocket'
import type {
  ServerMessage,
  Player,
  PublicGameState,
  GameState,
  Team,
  Role,
} from '@shared/types'

// Storage keys
const PLAYER_ID_KEY = 'codenames_player_id'
const PLAYER_NAME_KEY = 'codenames_player_name'

interface UseGameStateOptions {
  serverUrl: string
}

interface UseGameStateReturn {
  // Connection
  connectionStatus: ConnectionStatus
  error: string | null
  clearError: () => void

  // Player info
  playerId: string | null
  playerName: string | null
  roomCode: string | null

  // Game state
  gameState: PublicGameState | GameState | null
  players: Player[]
  isSpymaster: boolean

  // Actions
  createRoom: (name: string) => void
  joinRoom: (roomCode: string, name: string) => void
  leaveRoom: () => void
  setTeam: (team: Team) => void
  setRole: (role: Role) => void
  startGame: () => void
  submitClue: (word: string, count: number) => void
  guessWord: (tileId: string) => void
  endTurn: () => void
}

export function useGameState({ serverUrl }: UseGameStateOptions): UseGameStateReturn {
  // Player state
  const [playerId, setPlayerId] = useState<string | null>(() =>
    localStorage.getItem(PLAYER_ID_KEY)
  )
  const [playerName, setPlayerName] = useState<string | null>(() =>
    localStorage.getItem(PLAYER_NAME_KEY)
  )
  const [roomCode, setRoomCode] = useState<string | null>(null)

  // Game state
  const [gameState, setGameState] = useState<PublicGameState | GameState | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState<string | null>(null)

  // Determine if current player is spymaster
  const isSpymaster = players.find(p => p.id === playerId)?.role === 'spymaster'

  // Message handler
  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'room_created':
        setRoomCode(message.roomCode)
        setPlayerId(message.playerId)
        localStorage.setItem(PLAYER_ID_KEY, message.playerId)
        break

      case 'room_joined':
        setRoomCode(message.roomCode)
        setPlayerId(message.playerId)
        localStorage.setItem(PLAYER_ID_KEY, message.playerId)
        break

      case 'player_list':
        setPlayers(message.players)
        break

      case 'state_update':
        setGameState(message.state)
        break

      case 'state_update_spymaster':
        setGameState(message.state)
        break

      case 'clue_accepted':
        // Could show a toast/notification
        break

      case 'guess_result':
        // Animation/feedback handled by state_update
        break

      case 'turn_ended':
        // Handled by state_update
        break

      case 'game_over':
        // Could show modal - handled by checking gameState.phase
        break

      case 'error':
        setError(message.message)
        break
    }
  }, [])

  const handleConnect = useCallback(() => {
    // Request current state on reconnect
    if (roomCode && playerId) {
      send({ type: 'request_state' })
    }
  }, [roomCode, playerId])

  const { status: connectionStatus, send } = useWebSocket({
    url: serverUrl,
    onMessage: handleMessage,
    onConnect: handleConnect,
    autoReconnect: true,
  })

  // Clear error helper
  const clearError = useCallback(() => setError(null), [])

  // Actions
  const createRoom = useCallback((name: string) => {
    setPlayerName(name)
    localStorage.setItem(PLAYER_NAME_KEY, name)
    send({ type: 'create_room', name })
  }, [send])

  const joinRoom = useCallback((code: string, name: string) => {
    setPlayerName(name)
    localStorage.setItem(PLAYER_NAME_KEY, name)
    send({ type: 'join_room', roomCode: code, name })
  }, [send])

  const leaveRoom = useCallback(() => {
    send({ type: 'leave_room' })
    setRoomCode(null)
    setGameState(null)
    setPlayers([])
  }, [send])

  const setTeam = useCallback((team: Team) => {
    send({ type: 'set_team', team })
  }, [send])

  const setRole = useCallback((role: Role) => {
    send({ type: 'set_role', role })
  }, [send])

  const startGame = useCallback(() => {
    send({ type: 'start_game' })
  }, [send])

  const submitClue = useCallback((word: string, count: number) => {
    send({ type: 'submit_clue', word, count })
  }, [send])

  const guessWord = useCallback((tileId: string) => {
    send({ type: 'guess_word', tileId })
  }, [send])

  const endTurn = useCallback(() => {
    send({ type: 'end_turn' })
  }, [send])

  return {
    // Connection
    connectionStatus,
    error,
    clearError,

    // Player info
    playerId,
    playerName,
    roomCode,

    // Game state
    gameState,
    players,
    isSpymaster,

    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    setTeam,
    setRole,
    startGame,
    submitClue,
    guessWord,
    endTurn,
  }
}
