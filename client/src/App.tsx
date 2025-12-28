import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './hooks'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomCode" element={<Lobby />} />
          <Route path="/room/:roomCode/game" element={<Game />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
