import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getRandomWord } from '../lib/words'
import { useGame } from '../context/GameContext'

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function GameOver() {
  const { roomCode } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { saveSession, clearSession } = useGame()
  
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  const player = searchParams.get('player')
  const isWinner = room?.winner === (player === 'player1' ? room?.player1_name : room?.player2_name)

  useEffect(() => {
    async function loadRoom() {
      const { data: roomData, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (error || !roomData) {
        navigate('/?error=Sala no encontrada')
        return
      }

      setRoom(roomData)
      setLoading(false)
    }

    loadRoom()
  }, [roomCode])

  const handlePlayAgain = async () => {
    const stored = localStorage.getItem('palabrea_session')
    if (!stored) {
      navigate('/')
      return
    }

    try {
      const session = JSON.parse(stored)
      const playerName = session.playerName
      const newCode = generateCode()
      const currentWord = await getRandomWord()

      const { data, error } = await supabase
        .from('rooms')
        .insert({ 
          code: newCode, 
          status: 'waiting', 
          player1_name: playerName 
        })
        .select()
        .single()

      if (error) throw error

      // Save session with new room
      saveSession(playerName, newCode, 'player1')
      
      // Navigate to new room
      navigate(`/game/${newCode}?player=player1`)
    } catch (e) {
      console.error('Error creating new game:', e)
      navigate('/')
    }
  }

  const handleExit = () => {
    clearSession()
    navigate('/')
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {isWinner ? (
          <div className="mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-3xl font-bold text-yellow-400">
              ¡Has ganado, {room.winner}!
            </h1>
          </div>
        ) : (
          <div className="mb-8">
            <div className="text-6xl mb-4">😔</div>
            <h1 className="text-2xl font-bold text-gray-300">
              Has perdido
            </h1>
            <p className="text-gray-400 mt-2">¡Mejor suerte la próxima vez!</p>
          </div>
        )}

        <div className="bg-gray-800 p-6 rounded-xl mb-8">
          <h2 className="text-lg font-semibold mb-4">Marcador</h2>
          <div className="flex justify-center items-center text-xl">
            <span className={room.winner === room.player1_name ? 'text-green-400 font-bold' : ''}>
              {room.player1_name}: {room.score_p1 || 0}
            </span>
            <span className="mx-4 text-gray-500">—</span>
            <span className={room.winner === room.player2_name ? 'text-green-400 font-bold' : ''}>
              {room.player2_name}: {room.score_p2 || 0}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handlePlayAgain}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-lg font-semibold"
          >
            Volver a jugar
          </button>
          <button
            onClick={handleExit}
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}