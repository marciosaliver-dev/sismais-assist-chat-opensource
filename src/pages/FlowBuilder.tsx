import { useParams } from 'react-router-dom'
import { FlowListPage } from '@/components/flow-builder/FlowListPage'
import { FlowBuilderCanvas } from '@/components/flow-builder/FlowBuilderCanvas'

export default function FlowBuilder() {
  const { id } = useParams<{ id: string }>()

  if (id) {
    return <FlowBuilderCanvas flowId={id} />
  }

  return <FlowListPage />
}
