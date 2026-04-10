import { useParams } from 'react-router-dom'
import { ClientFullView } from '@/components/clients/ClientFullView'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <div className="p-6 text-center text-muted-foreground">Cliente nao encontrado.</div>
  return <ClientFullView clientId={id} mode="page" />
}
