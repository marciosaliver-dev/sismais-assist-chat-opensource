import { TriggerNode } from './TriggerNode'
import { SendMessageNode } from './SendMessageNode'
import { AIResponseNode } from './AIResponseNode'
import { AssignHumanNode } from './AssignHumanNode'
import { AssignAINode } from './AssignAINode'
import { ConditionNode } from './ConditionNode'
import { SwitchNode } from './SwitchNode'
import { DelayNode } from './DelayNode'
import { HTTPRequestNode } from './HTTPRequestNode'
import { AddTagNode } from './AddTagNode'
import { SetVariableNode } from './SetVariableNode'
import { UpdateFieldNode } from './UpdateFieldNode'
import { JumpToFlowNode } from './JumpToFlowNode'
import { EndNode } from './EndNode'
import { SearchKnowledgeNode } from './SearchKnowledgeNode'
import { MoveToStageNode } from './MoveToStageNode'
import { MoveToBoardNode } from './MoveToBoardNode'
import { RemoveTagNode } from './RemoveTagNode'
import { ChangeCategoryNode } from './ChangeCategoryNode'
import { ChangeModuleNode } from './ChangeModuleNode'
import { CreateConversationNode } from './CreateConversationNode'
import { SendInternalMessageNode } from './SendInternalMessageNode'
import { CheckScheduleNode } from './CheckScheduleNode'
import { WaitResponseNode } from './WaitResponseNode'
import { CheckCustomerNode } from './CheckCustomerNode'
import { LoopWaitNode } from './LoopWaitNode'

export const customNodeTypes = {
  trigger: TriggerNode,
  send_message: SendMessageNode,
  ai_response: AIResponseNode,
  assign_human: AssignHumanNode,
  assign_ai: AssignAINode,
  condition: ConditionNode,
  switch: SwitchNode,
  delay: DelayNode,
  http_request: HTTPRequestNode,
  add_tag: AddTagNode,
  set_variable: SetVariableNode,
  update_field: UpdateFieldNode,
  jump_to_flow: JumpToFlowNode,
  end: EndNode,
  search_knowledge: SearchKnowledgeNode,
  move_to_stage: MoveToStageNode,
  move_to_board: MoveToBoardNode,
  remove_tag: RemoveTagNode,
  change_category: ChangeCategoryNode,
  change_module: ChangeModuleNode,
  create_conversation: CreateConversationNode,
  send_internal_message: SendInternalMessageNode,
  check_schedule: CheckScheduleNode,
  wait_response: WaitResponseNode,
  check_customer: CheckCustomerNode,
  loop_wait: LoopWaitNode,
}
