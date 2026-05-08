import { HashRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './context/GameContext'
import Home from './pages/Home'
import Game from './pages/Game'
import GameOver from './pages/GameOver'

export default function App() {
  return (
    <HashRouter>
      <GameProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:roomCode" element={<Game />} />
          <Route path="/gameover/:roomCode" element={<GameOver />} />
        </Routes>
      </GameProvider>
    </HashRouter>
  )
}