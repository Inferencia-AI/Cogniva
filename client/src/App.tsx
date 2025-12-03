import './App.css'
import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Login from './pages/login.tsx'
import Home from './pages/home.tsx'

function App() {
  return (
    <BrowserRouter>
    <Routes>
    <Route element={<Login />} path='/' />
    <Route element={<Home />} path='/home' />
    </Routes>
    </BrowserRouter>
  )
}

export default App
