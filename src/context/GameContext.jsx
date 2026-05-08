import { createContext, useContext, useReducer, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GameContext = createContext()

const initialState = {
  playerName: '',
  roomCode: '',
  playerSlot: '',
  room: null,
  moves: [],
  isLoading: false,
  error: null,
  isMyTurn: false
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        playerName: action.payload.playerName,
        roomCode: action.payload.roomCode,
        playerSlot: action.payload.playerSlot
      }
    case 'SET_ROOM': {
      const room = action.payload
      if (!room) return { ...state, room: null, isMyTurn: false }
      const myName = state.playerSlot === 'player1' ? room.player1_name : room.player2_name
      return {
        ...state,
        room,
        isMyTurn: room.current_turn === myName
      }
    }
    case 'SET_MOVES':
      return { ...state, moves: action.payload }
    case 'ADD_MOVE':
      return { ...state, moves: [...state.moves, action.payload] }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'UPDATE_TURN': {
      const newTurn = action.payload
      const myName = state.playerSlot === 'player1' ? state.room?.player1_name : state.room?.player2_name
      return {
        ...state,
        room: { ...state.room, current_turn: newTurn },
        isMyTurn: newTurn === myName
      }
    }
    case 'SET_GAME_FINISHED':
      return { ...state, room: { ...state.room, status: 'finished', winner: action.payload } }
    case 'CLEAR_SESSION':
      return initialState
    default:
      return state
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [sessionToRestore, setSessionToRestore] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('palabrea_session')
    if (stored) {
      try {
        const session = JSON.parse(stored)
        setSessionToRestore(session)
      } catch (e) {
        localStorage.removeItem('palabrea_session')
      }
    }
  }, [])

  useEffect(() => {
    if (!sessionToRestore) return

    async function restoreSession() {
      const { playerName, roomCode, playerSlot } = sessionToRestore

      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (room && (room.status === 'waiting' || room.status === 'playing')) {
        dispatch({ type: 'SET_SESSION', payload: { playerName, roomCode, playerSlot } })
        if (room.status === 'playing') {
          dispatch({ type: 'SET_ROOM', payload: room })
        }
      } else {
        localStorage.removeItem('palabrea_session')
      }
      setSessionToRestore(null)
    }

    restoreSession()
  }, [sessionToRestore])

  const saveSession = (playerName, roomCode, playerSlot) => {
    const session = { playerName, roomCode, playerSlot }
    localStorage.setItem('palabrea_session', JSON.stringify(session))
    dispatch({ type: 'SET_SESSION', payload: session })
  }

  const clearSession = () => {
    localStorage.removeItem('palabrea_session')
    dispatch({ type: 'CLEAR_SESSION' })
  }

  const setRoom = (room) => {
    dispatch({ type: 'SET_ROOM', payload: room })
  }

  const setMoves = (moves) => {
    dispatch({ type: 'SET_MOVES', payload: moves })
  }

  const addMove = (move) => {
    dispatch({ type: 'ADD_MOVE', payload: move })
  }

  const updateTurn = (turn) => {
    dispatch({ type: 'UPDATE_TURN', payload: turn })
  }

  const setGameFinished = (winner) => {
    dispatch({ type: 'SET_GAME_FINISHED', payload: winner })
  }

  const setLoading = (isLoading) => {
    dispatch({ type: 'SET_LOADING', payload: isLoading })
  }

  const setError = (error) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }

  return (
    <GameContext.Provider
      value={{
        ...state,
        saveSession,
        clearSession,
        setRoom,
        setMoves,
        addMove,
        updateTurn,
        setGameFinished,
        setLoading,
        setError
      }}
    >
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