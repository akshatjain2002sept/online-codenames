import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, ServerMessage } from '@shared/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

interface UseWebSocketOptions {
  url: string
  onMessage?: (message: ServerMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface UseWebSocketReturn {
  status: ConnectionStatus
  send: (message: ClientMessage) => void
  connect: () => void
  disconnect: () => void
  lastMessage: ServerMessage | null
}

const PING_INTERVAL = 30000 // 30 seconds
const PONG_TIMEOUT = 5000 // 5 seconds to receive pong

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  autoReconnect = true,
  reconnectInterval = 2000,
  maxReconnectAttempts = 10,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(autoReconnect)

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current)
      pongTimeoutRef.current = null
    }
  }, [])

  const startPingInterval = useCallback(() => {
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingMessage: ClientMessage = { type: 'ping', ts: Date.now() }
        wsRef.current.send(JSON.stringify(pingMessage))

        // Set pong timeout
        pongTimeoutRef.current = setTimeout(() => {
          console.warn('[WebSocket] Pong timeout, reconnecting...')
          wsRef.current?.close()
        }, PONG_TIMEOUT)
      }
    }, PING_INTERVAL)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    clearTimers()
    setStatus('connecting')

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setStatus('connected')
        reconnectAttemptsRef.current = 0
        startPingInterval()
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage

          // Handle pong - clear timeout
          if (message.type === 'pong') {
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current)
              pongTimeoutRef.current = null
            }
            return
          }

          setLastMessage(message)
          onMessage?.(message)
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event)
      }

      ws.onclose = (event) => {
        console.log('[WebSocket] Closed:', event.code, event.reason)
        clearTimers()
        wsRef.current = null

        if (shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          setStatus('reconnecting')
          reconnectAttemptsRef.current++

          const delay = Math.min(
            reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1),
            30000
          )

          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          setStatus('disconnected')
          onDisconnect?.()
        }
      }
    } catch (err) {
      console.error('[WebSocket] Failed to connect:', err)
      setStatus('disconnected')
    }
  }, [url, onMessage, onConnect, onDisconnect, clearTimers, startPingInterval, reconnectInterval, maxReconnectAttempts])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    clearTimers()
    wsRef.current?.close(1000, 'Client disconnect')
    wsRef.current = null
    setStatus('disconnected')
  }, [clearTimers])

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('[WebSocket] Cannot send message, not connected')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    shouldReconnectRef.current = autoReconnect
    connect()

    return () => {
      shouldReconnectRef.current = false
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'disconnected' && autoReconnect) {
        reconnectAttemptsRef.current = 0
        shouldReconnectRef.current = true
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [status, autoReconnect, connect])

  return {
    status,
    send,
    connect,
    disconnect,
    lastMessage,
  }
}
