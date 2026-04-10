import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { useAuth } from '@/contexts/AuthContext'
import { useQueueAlerts } from '@/hooks/useQueueAlerts'
import { QueueAlertModal } from '@/components/QueueAlertModal'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth()
  const isLeaderOrAdmin = user?.role === 'admin' || user?.role === 'lider'
  const { overdueTickets, hasAlert, dismissAlert } = useQueueAlerts()

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-[#F8FAFC] dark:bg-background">
        {children}
      </main>
      <CommandPalette />
      {isLeaderOrAdmin && (
        <QueueAlertModal
          open={hasAlert}
          overdueTickets={overdueTickets}
          onDismiss={dismissAlert}
        />
      )}
    </div>
  )
}
