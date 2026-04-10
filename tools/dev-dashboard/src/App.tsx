import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { TaskBoard } from './pages/TaskBoard'
import { Approvals } from './pages/Approvals'
import { Timeline } from './pages/Timeline'

function Placeholder({ name }: { name: string }) {
  return <div className="flex-1 flex items-center justify-center text-white/30 text-lg">{name} — coming next</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<TaskBoard />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/timeline" element={<Timeline />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
