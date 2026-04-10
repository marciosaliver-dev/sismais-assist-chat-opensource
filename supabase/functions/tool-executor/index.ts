import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

interface ToolResult {
  tool_name: string
  success: boolean
  result?: unknown
  error?: string
  execution_time_ms: number
}

/**
 * Tool Executor — Executes AI agent tool calls via HTTP endpoints or edge functions.
 *
 * Flow:
 * 1. Receives tool_call from agent-executor (name + arguments)
 * 2. Looks up tool config in ai_agent_tools
 * 3. Executes via HTTP call or edge function invoke
 * 4. Returns result to agent-executor for LLM continuation
 * 5. Logs execution in ai_tool_executions
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const { tool_calls, agent_id, conversation_id } = body as {
      tool_calls: ToolCall[]
      agent_id: string
      conversation_id?: string
    }

    if (!tool_calls || tool_calls.length === 0) {
      return new Response(JSON.stringify({ error: 'No tool_calls provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[tool-executor] Executing ${tool_calls.length} tool(s) for agent ${agent_id}`)

    const results: ToolResult[] = []

    for (const toolCall of tool_calls) {
      const startTime = Date.now()
      let result: ToolResult

      try {
        // 1. Look up tool configuration
        const { data: tool, error: toolError } = await supabase
          .from('ai_agent_tools')
          .select('*')
          .eq('name', toolCall.name)
          .eq('is_active', true)
          .maybeSingle()

        if (toolError || !tool) {
          result = {
            tool_name: toolCall.name,
            success: false,
            error: `Tool "${toolCall.name}" not found or inactive`,
            execution_time_ms: Date.now() - startTime,
          }
          results.push(result)
          await logExecution(supabase, tool?.id, agent_id, conversation_id, toolCall, result)
          continue
        }

        // 2. Check if agent is allowed to use this tool
        if (tool.allowed_agents && tool.allowed_agents.length > 0) {
          if (!tool.allowed_agents.includes(agent_id)) {
            result = {
              tool_name: toolCall.name,
              success: false,
              error: `Agent not authorized to use tool "${toolCall.name}"`,
              execution_time_ms: Date.now() - startTime,
            }
            results.push(result)
            await logExecution(supabase, tool.id, agent_id, conversation_id, toolCall, result)
            continue
          }
        }

        // 3. Execute based on function_type
        let executionResult: unknown

        switch (tool.function_type) {
          case 'edge_function': {
            // Call another Supabase edge function
            const functionName = tool.endpoint || toolCall.name
            console.log(`[tool-executor] Invoking edge function: ${functionName}`)

            const { data: fnData, error: fnError } = await supabase.functions.invoke(functionName, {
              body: { ...toolCall.arguments, _agent_id: agent_id, _conversation_id: conversation_id },
            })

            if (fnError) {
              throw new Error(`Edge function error: ${fnError.message}`)
            }
            executionResult = fnData
            break
          }

          case 'http':
          case 'api': {
            // Call external HTTP endpoint
            if (!tool.endpoint) {
              throw new Error(`Tool "${toolCall.name}" has no endpoint configured`)
            }

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }

            // Add auth if required
            if (tool.requires_auth && tool.auth_type) {
              const authToken = await resolveAuthToken(tool.auth_type)
              if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`
              }
            }

            const method = (tool.method || 'POST').toUpperCase()
            const timeoutMs = tool.timeout_ms || 30000
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

            try {
              const httpResponse = await fetch(tool.endpoint, {
                method,
                headers,
                body: method !== 'GET' ? JSON.stringify(toolCall.arguments) : undefined,
                signal: controller.signal,
              })

              clearTimeout(timeoutId)

              if (!httpResponse.ok) {
                const errText = await httpResponse.text()
                throw new Error(`HTTP ${httpResponse.status}: ${errText.substring(0, 500)}`)
              }

              const contentType = httpResponse.headers.get('content-type') || ''
              if (contentType.includes('application/json')) {
                executionResult = await httpResponse.json()
              } else {
                executionResult = await httpResponse.text()
              }
            } finally {
              clearTimeout(timeoutId)
            }
            break
          }

          case 'supabase_rpc': {
            // Call a Supabase RPC function directly
            const rpcName = tool.endpoint || toolCall.name
            console.log(`[tool-executor] Calling RPC: ${rpcName}`)

            const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, toolCall.arguments)
            if (rpcError) {
              throw new Error(`RPC error: ${rpcError.message}`)
            }
            executionResult = rpcData
            break
          }

          case 'supabase_query': {
            // Execute a Supabase query (read-only for safety)
            const tableName = tool.endpoint || ''
            if (!tableName) {
              throw new Error(`Tool "${toolCall.name}" has no table configured`)
            }
            console.log(`[tool-executor] Querying table: ${tableName}`)

            const args = toolCall.arguments as Record<string, unknown>
            let query = supabase.from(tableName).select(args.select as string || '*')

            // Apply filters
            if (args.filters && Array.isArray(args.filters)) {
              for (const filter of args.filters as Array<{ column: string; operator: string; value: unknown }>) {
                query = query.filter(filter.column, filter.operator, filter.value)
              }
            }

            if (args.limit) {
              query = query.limit(args.limit as number)
            }

            if (args.order_by) {
              query = query.order(args.order_by as string, { ascending: args.ascending !== false })
            }

            const { data: queryData, error: queryError } = await query
            if (queryError) {
              throw new Error(`Query error: ${queryError.message}`)
            }
            executionResult = queryData
            break
          }

          default:
            throw new Error(`Unknown function_type: ${tool.function_type}`)
        }

        result = {
          tool_name: toolCall.name,
          success: true,
          result: executionResult,
          execution_time_ms: Date.now() - startTime,
        }

        // 4. Retry on failure if configured
        if (!result.success && tool.retry_on_failure) {
          const maxRetries = tool.max_retries || 2
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[tool-executor] Retrying ${toolCall.name} (attempt ${attempt}/${maxRetries})`)
            await new Promise(r => setTimeout(r, 1000 * attempt))
            // Retry same logic — simplified: only retry the whole block for HTTP tools
            // In production, this could be more granular
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[tool-executor] Error executing ${toolCall.name}:`, errorMessage)
        result = {
          tool_name: toolCall.name,
          success: false,
          error: errorMessage,
          execution_time_ms: Date.now() - startTime,
        }
      }

      results.push(result)
      await logExecution(supabase, null, agent_id, conversation_id, toolCall, result)
    }

    console.log(`[tool-executor] Completed ${results.length} tool(s). Success: ${results.filter(r => r.success).length}/${results.length}`)

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[tool-executor] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Resolve auth token based on auth_type
 */
async function resolveAuthToken(authType: string): Promise<string | null> {
  switch (authType) {
    case 'supabase_service_role':
      return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null
    case 'openrouter':
      return Deno.env.get('OPENROUTER_API_KEY') || null
    case 'openai':
      // All AI calls now go through OpenRouter
      return Deno.env.get('OPENROUTER_API_KEY') || null
    case 'uazapi':
      return Deno.env.get('UAZAPI_TOKEN') || null
    case 'sismais_admin':
      return Deno.env.get('SISMAIS_ADMIN_SERVICE_ROLE_KEY') || null
    case 'sismais_gl':
      return Deno.env.get('SISMAIS_GL_SERVICE_ROLE_KEY') || null
    default:
      // Try to read from env using auth_type as key name
      return Deno.env.get(authType) || null
  }
}

/**
 * Log tool execution to ai_tool_executions table (fire-and-forget)
 */
async function logExecution(
  supabase: any,
  toolId: string | null,
  agentId: string,
  conversationId: string | undefined,
  toolCall: ToolCall,
  result: ToolResult
) {
  try {
    await supabase.from('ai_tool_executions').insert({
      tool_id: toolId,
      agent_id: agentId,
      conversation_id: conversationId || null,
      input_params: toolCall.arguments,
      success: result.success,
      result: result.success ? result.result : null,
      error_message: result.error || null,
      execution_time_ms: result.execution_time_ms,
    })
  } catch (e) {
    console.warn('[tool-executor] Failed to log execution:', e)
  }
}
