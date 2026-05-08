import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGame } from '../context/GameContext'

export default function GameOver() {
  const { roomCode } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { clearSession } = useGame()
  
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState(false)

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

  useEffect(() => {
    async function updateScore() {
      if (!room || updated) return

      const winnerIsP1 = room.winner === room.player1_name
      
      if ((winnerIsP1 && player === 'player1') || (!winnerIsP1 && player === 'player2')) {
        setUpdated(true)
        
        if (winnerIsP1) {
          await supabase
            .from('rooms')
            .update({ score_p1: (room.score_p1 || 0) + 1 })
            .eq('id', room.id)
        } else {
          await supabase
            .from('rooms')
            .update({ score_p2: (room.score_p2 || 0) + 1 })
            .eq('id', room.id)
        }
      }
    }

    updateScore()
  }, [room, player])

  const handlePlayAgain = () => {
    navigate('/')
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