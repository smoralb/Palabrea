import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGame } from '../context/GameContext'
import ChatBubble from '../components/ChatBubble'

function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function Game() {
  const { roomCode } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { playerName, playerSlot, setRoom, setMoves, addMove, updateTurn, setGameFinished, clearSession } = useGame()
  
  const [room, setLocalRoom] = useState(null)
  const [moves, setLocalMoves] = useState([])
  const [wordInput, setWordInput] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const chatRef = useRef(null)
  const [waitedTooLong, setWaitedTooLong] = useState(false)

  const isMyTurn = room?.current_turn === (playerSlot === 'player1' ? room?.player1_name : room?.player2_name)
  const currentWord = room?.current_word || ''
  const prefix = currentWord.slice(0, 2).toUpperCase()
  const rest = currentWord.slice(2)

  useEffect(() => {
    const timer = setTimeout(() => setWaitedTooLong(true), 5 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    async function loadRoom() {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomError || !roomData) {
        navigate('/?error=Sala no encontrada')
        return
      }

      if (roomData.status === 'finished') {
        navigate(`/gameover/${roomCode}?player=${searchParams.get('player')}`)
        return
      }

      setLocalRoom(roomData)
      setRoom(roomData)

      const { data: movesData } = await supabase
        .from('moves')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })

      setLocalMoves(movesData || [])
      setMoves(movesData || [])
    }

    loadRoom()
  }, [roomCode])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [moves])

  useEffect(() => {
    let roomChannel
    let movesChannel

    if (room) {
      roomChannel = supabase
        .channel(`game:room:${roomCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, payload => {
          if (payload.eventType === 'UPDATE') {
            const newRoom = { ...room, ...payload.new }
            setLocalRoom(newRoom)
            setRoom(newRoom)
            if (payload.new.status === 'finished') {
              navigate(`/gameover/${roomCode}?player=${searchParams.get('player')}`)
            }
          }
        })
        .subscribe()

      movesChannel = supabase
        .channel(`game:moves:${roomCode}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `room_id=eq.${room.id}` }, payload => {
          const newMove = payload.new
          setLocalMoves(prev => [...prev, newMove])
          addMove(newMove)
          if (playerSlot === 'player1') {
            updateTurn(room.player2_name)
          } else {
            updateTurn(room.player1_name)
          }
        })
        .subscribe()
    }

    return () => {
      if (roomChannel) supabase.removeChannel(roomChannel)
      if (movesChannel) supabase.removeChannel(movesChannel)
    }
  }, [room?.id, roomCode])

  const validateWord = async (word) => {
    const cleanWord = removeAccents(word.toLowerCase())
    const cleanRef = removeAccents(currentWord.toLowerCase())
    
    if (word.length < 3) {
      return 'La palabra debe tener al menos 3 letras'
    }
    
    if (!cleanWord.startsWith(cleanRef.slice(0, 2))) {
      return `La palabra debe empezar por "${prefix}" (ignorando tildes)`
    }
    
    const existingWords = moves.map(m => m.word.toLowerCase())
    if (existingWords.includes(cleanWord)) {
      return 'Esa palabra ya se usó en esta partida'
    }
    
    try {
      const res = await fetch(`https://palabras.suincore.com/api/${word}`)
      if (!res.ok) {
        return 'Palabra no encontrada en el diccionario'
      }
    } catch (e) {
      // Si la API falla, permitir la palabra
      console.warn('Error validando palabra:', e)
    }
    
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isMyTurn || sending) return

    setError('')
    
    const validationError = await validateWord(wordInput)
    if (validationError) {
      setError(validationError)
      return
    }

    setSending(true)
    
    try {
      const nextTurn = playerSlot === 'player1' ? room.player2_name : room.player1_name
      
      await supabase
        .from('moves')
        .insert({ room_id: room.id, player: playerName, word: wordInput.toLowerCase() })

      await supabase
        .from('rooms')
        .update({ current_turn: nextTurn })
        .eq('id', room.id)

      const updatedRoom = { ...room, current_turn: nextTurn }
      setLocalRoom(updatedRoom)
      setRoom(updatedRoom)
      
      setWordInput('')
    } catch (e) {
      setError('Error al enviar: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  const handleSurrender = async () => {
    const confirmed = window.confirm('¿Seguro que quieres rendirte?')
    if (!confirmed) return

    const winner = playerSlot === 'player1' ? room.player2_name : room.player1_name
    const winnerIsP1 = winner === room.player1_name
    
    // Actualizar estado y score
    await supabase
      .from('rooms')
      .update({ 
        status: 'finished', 
        winner,
        score_p1: winnerIsP1 ? (room.score_p1 || 0) + 1 : room.score_p1,
        score_p2: !winnerIsP1 ? (room.score_p2 || 0) + 1 : room.score_p2
      })
      .eq('id', room.id)

    navigate(`/gameover/${roomCode}?player=${searchParams.get('player')}`)
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 sticky top-0 z-10">
        <div className="text-center">
          <span className="text-gray-400">Turno de: </span>
          <span className={`font-semibold ${isMyTurn ? 'text-green-400' : 'text-yellow-400'}`}>
            {room.current_turn}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 bg-gray-800 border-b border-gray-700 sticky top-12 z-10">
        <p className="text-center text-gray-400 text-sm mb-1">Palabra de referencia:</p>
        <p className="text-center text-2xl">
          <span className="font-bold text-yellow-400">{prefix}</span>
          <span>{rest}</span>
        </p>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
        {moves.map((move, idx) => (
          <ChatBubble
            key={move.id || idx}
            word={move.word}
            player={move.player}
            currentPlayer={playerName}
            timestamp={move.created_at}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-gray-800 border-t border-gray-700 sticky bottom-0 z-10">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={wordInput}
            onChange={e => setWordInput(e.target.value)}
            placeholder={isMyTurn ? 'Escribe una palabra...' : 'No es tu turno'}
            disabled={!isMyTurn}
            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 disabled:opacity-50"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!isMyTurn || !wordInput.trim() || sending}
            className="px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            →
          </button>
        </div>
        
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSurrender}
          className="w-full mt-3 px-4 py-2 bg-red-900 hover:bg-red-800 rounded-lg transition-colors text-gray-400"
        >
          Rendirse
        </button>
      </form>
    </div>
  )
}