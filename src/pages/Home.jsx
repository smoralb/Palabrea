import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getRandomWord } from '../lib/words'
import { useGame } from '../context/GameContext'
import ActiveRoomsBanner from '../components/ActiveRoomsBanner'

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function clearSession() {
  localStorage.removeItem('palabrea_session')
  window.location.reload()
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { saveSession, room } = useGame()
  
  const [playerName, setPlayerName] = useState('')
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [mode, setMode] = useState('')
  const [loading, setLoadingLocal] = useState(false)
  const [createdCode, setCreatedCode] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [error, setErrorLocal] = useState('')
  const [cancelTimer, setCancelTimer] = useState(null)

  useEffect(() => {
    if (room && room.status === 'playing') {
      navigate(`/game/${room.code}?player=player1`)
    }
  }, [room, navigate])

  // Handle join from shared link
  useEffect(() => {
    const joinCode = searchParams.get('join')
    if (joinCode === 'true' && !mode) {
      // Find the room code from URL path
      const pathParts = window.location.pathname.split('/')
      const codeFromUrl = pathParts[pathParts.length - 1]
      if (codeFromUrl && codeFromUrl.length === 6) {
        setMode('join')
        setRoomCodeInput(codeFromUrl)
      }
    }
  }, [searchParams, mode])

  useEffect(() => {
    let channel
    if (createdCode && waiting) {
      channel = supabase
        .channel(`room:${createdCode}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${createdCode}` }, payload => {
          if (payload.new.status === 'playing') {
            navigate(`/game/${createdCode}?player=player1`)
          }
        })
        .subscribe()

      const timer = setTimeout(() => {
        setCancelTimer(true)
      }, 5 * 60 * 1000)

      return () => {
        clearTimeout(timer)
        if (channel) supabase.removeChannel(channel)
      }
    }
  }, [createdCode, waiting, navigate])

  const handleCreate = async () => {
    setErrorLocal('')
    if (playerName.length < 2) {
      setErrorLocal('El nombre debe tener al menos 2 caracteres')
      return
    }

    setLoadingLocal(true)
    try {
      const code = generateCode()
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert({ code, status: 'waiting', player1_name: playerName })
        .select()
        .single()

      if (insertError) throw insertError

      await supabase
        .from('player_sessions')
        .insert({ player_name: playerName, room_id: data.id, room_code: code, player_slot: 'player1' })

      saveSession(playerName, code, 'player1')
      setCreatedCode(code)
      setWaiting(true)
    } catch (e) {
      setErrorLocal('Error al crear la sala: ' + e.message)
    } finally {
      setLoadingLocal(false)
    }
  }

  const handleJoin = async () => {
    setErrorLocal('')
    if (playerName.length < 2) {
      setErrorLocal('El nombre debe tener al menos 2 caracteres')
      return
    }
    if (!roomCodeInput) {
      setErrorLocal('Ingresa el codigo de la sala')
      return
    }

    setLoadingLocal(true)
    try {
      const { data: existingRoom, error: findError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCodeInput.toUpperCase())
        .single()

      if (findError || !existingRoom) {
        setErrorLocal('Sala no encontrada o ya en curso')
        setLoadingLocal(false)
        return
      }

      if (existingRoom.status !== 'waiting') {
        setErrorLocal('Sala no encontrada o ya en curso')
        setLoadingLocal(false)
        return
      }

      const currentWord = await getRandomWord()
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          player2_name: playerName,
          status: 'playing',
          current_turn: existingRoom.player1_name,
          current_word: currentWord
        })
        .eq('id', existingRoom.id)

      if (updateError) throw updateError

      await supabase
        .from('player_sessions')
        .insert({ player_name: playerName, room_id: existingRoom.id, room_code: roomCodeInput.toUpperCase(), player_slot: 'player2' })

      saveSession(playerName, roomCodeInput.toUpperCase(), 'player2')
      navigate(`/game/${roomCodeInput.toUpperCase()}?player=player2`)
    } catch (e) {
      setErrorLocal('Error al unirse: ' + e.message)
    } finally {
      setLoadingLocal(false)
    }
  }

  const handleCancelRoom = async () => {
    if (!createdCode) return
    
    await supabase.from('rooms').delete().eq('code', createdCode)
    localStorage.removeItem('palabrea_session')
    setCreatedCode('')
    setWaiting(false)
    setCancelTimer(null)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdCode)
  }

  const handleShare = async () => {
    const roomLink = `${window.location.origin}/#/game/${createdCode}?join=true`
    const shareData = {
      title: 'Palabrea - Juego de palabras',
      text: `Unete a mi partida en Palabrea! Usa este enlace: ${roomLink}`,
      url: roomLink
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (e) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(roomLink)
      alert('Enlace copiado!')
    }
  }

  if (waiting && createdCode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-2 text-yellow-400">Palabrea</h1>
          <p className="text-gray-400 mb-6">Sala creada</p>
          
          <div className="bg-gray-700 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-400 mb-2">Codigo de la sala</p>
            <div className="text-4xl font-mono font-bold tracking-wider text-white">{createdCode}</div>
          </div>
          
          <button
            onClick={handleCopyCode}
            className="w-full mb-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Copiar codigo
          </button>
          
          <button
            onClick={handleShare}
            className="w-full mb-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Compartir
          </button>
          
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Esperando a que se una un jugador...</span>
          </div>
          
          <button
            onClick={handleCancelRoom}
            className="mt-6 w-full px-4 py-3 bg-red-700 hover:bg-red-600 rounded-lg transition-colors"
          >
            Cancelar sala
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-yellow-400">Palabrea</h1>
        
        <ActiveRoomsBanner />
        
        <div className="bg-gray-800 p-6 rounded-xl">
          {!mode ? (
            <div className="space-y-4">
              <button
                onClick={() => setMode('create')}
                className="w-full px-4 py-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-lg font-semibold"
              >
                Crear sala
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-lg font-semibold"
              >
                Unirse a sala
              </button>
              <button
                onClick={clearSession}
                className="w-full px-4 py-2 text-gray-500 hover:text-gray-300 text-sm"
              >
                Cerrar sesion
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => { setMode(''); setCreatedCode(''); setPlayerName(''); setRoomCodeInput('') }}
                className="text-gray-400 text-sm hover:text-white"
              >
                Volver
              </button>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Tu nombre</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="Escribe tu nombre"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                  minLength={2}
                />
              </div>
              
              {mode === 'join' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Codigo de la sala</label>
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="Codigo de 6 letras"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 font-mono uppercase"
                    maxLength={6}
                  />
                </div>
              )}
              
              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                disabled={loading}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-lg font-semibold"
              >
                {loading ? 'Cargando...' : mode === 'create' ? 'Crear sala' : 'Unirse'}
              </button>
              
              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}