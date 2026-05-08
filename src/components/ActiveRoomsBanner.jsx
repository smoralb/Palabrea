import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ActiveRoomsBanner() {
  const [activeRooms, setActiveRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadActiveRooms() {
      const stored = localStorage.getItem('palabrea_session')
      if (!stored) {
        setLoading(false)
        return
      }

      try {
        const session = JSON.parse(stored)
        const { playerName } = session

        const { data: sessions } = await supabase
          .from('player_sessions')
          .select('room_code, player_slot, room_id')
          .eq('player_name', playerName)

        if (!sessions || sessions.length === 0) {
          setLoading(false)
          return
        }

        const roomCodes = sessions.map(s => s.room_code)

        const { data: rooms } = await supabase
          .from('rooms')
          .select('*')
          .in('code', roomCodes)
          .in('status', ['waiting', 'playing'])

        const enrichedRooms = sessions.map(session => {
          const room = rooms?.find(r => r.code === session.room_code)
          if (!room) return null
          
          const opponentName = session.player_slot === 'player1' ? room.player2_name : room.player1_name
          const isMyTurn = room.current_turn === (session.player_slot === 'player1' ? room.player1_name : room.player2_name)
          
          return {
            ...room,
            playerSlot: session.player_slot,
            opponentName,
            isMyTurn
          }
        }).filter(Boolean)

        setActiveRooms(enrichedRooms)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadActiveRooms()
  }, [])

  if (loading) {
    return (
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <div className="animate-pulse flex space-x-4">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (activeRooms.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-3 text-yellow-400">Tus partidas activas</h2>
      <div className="grid gap-3">
        {activeRooms.map(room => (
          <div key={room.code} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-mono text-yellow-300">Sala: {room.code}</div>
                <div className="text-sm text-gray-400">
                  {room.opponentName ? `vs ${room.opponentName}` : 'Esperando rival'}
                </div>
                <div className="text-xs mt-1">
                  {room.status === 'waiting' ? (
                    <span className="text-yellow-500">Esperando rival</span>
                  ) : (
                    <span className={room.isMyTurn ? 'text-green-400' : 'text-gray-500'}>
                      {room.isMyTurn ? `Tu turno` : `Turno de ${room.current_turn}`}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/game/${room.code}?player=${room.playerSlot}`)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Reconectarse
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}