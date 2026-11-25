import { useEffect, useState } from 'react'

export function useResource(key, load) {
  const [state, setState] = useState({ key: null })

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    load(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setState({ key, value, loading: false })
      },
      (error) => {
        if (!controller.signal.aborted) setState({ key, error, loading: false })
      },
    )
    return () => controller.abort()
  }, [key, load])

  if (!key) return {}
  return state.key === key ? state : { loading: true }
}
