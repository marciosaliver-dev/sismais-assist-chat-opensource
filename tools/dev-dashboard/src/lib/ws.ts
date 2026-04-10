type Listener = (event: { type: string; data: unknown }) => void

let socket: WebSocket | null = null
const listeners: Set<Listener> = new Set()

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${location.host}/ws`)

  socket.onmessage = (e) => {
    const event = JSON.parse(e.data)
    listeners.forEach(fn => fn(event))
  }

  socket.onclose = () => {
    setTimeout(connect, 3000)
  }

  socket.onerror = () => socket?.close()
}

export function subscribe(fn: Listener) {
  if (!socket) connect()
  listeners.add(fn)
  return () => listeners.delete(fn)
}
