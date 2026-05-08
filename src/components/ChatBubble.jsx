export default function ChatBubble({ word, player, currentPlayer, timestamp }) {
  const isMyMessage = player === currentPlayer
  
  const time = new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  
  return (
    <div className={`flex flex-col mb-3 ${isMyMessage ? 'items-end' : 'items-start'}`}>
      <div className={`text-xs mb-1 ${isMyMessage ? 'text-green-400' : 'text-gray-400'}`}>
        {player}
      </div>
      <div
        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
          isMyMessage ? 'bg-green-700' : 'bg-gray-700'
        }`}
      >
        <span className="text-base">{word}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">{time}</div>
    </div>
  )
}