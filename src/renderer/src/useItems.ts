import { useEffect, useState } from 'react'
import type { Item } from '@shared/api'

export const url = (relPath: string): string => 'lompii://' + relPath

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => {
    window.lompii.list().then(setItems)
    const offAdded = window.lompii.onAdded((item) => setItems((prev) => [item, ...prev]))
    const offUpdated = window.lompii.onUpdated((item) =>
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
    )
    return () => {
      offAdded()
      offUpdated()
    }
  }, [])
  return [items, setItems] as const
}
