import { type Ref, onMounted, onUnmounted } from 'vue'

type IOEntry = {
  observer: IntersectionObserver
  cbs: Map<Element, (e: IntersectionObserverEntry) => void>
}

const cache = new Map<number, IOEntry>()

function getShared(threshold: number): IOEntry {
  if (cache.has(threshold)) return cache.get(threshold)!
  const cbs = new Map<Element, (e: IntersectionObserverEntry) => void>()
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => cbs.get(e.target)?.(e)),
    { threshold },
  )
  const entry: IOEntry = { observer, cbs }
  cache.set(threshold, entry)
  return entry
}

export function useIntersect(
  targetRef: Ref<Element | null | undefined>,
  callback: (entry: IntersectionObserverEntry) => void,
  threshold = 0.3,
) {
  onMounted(() => {
    const el = targetRef.value
    if (!el) return
    const { observer, cbs } = getShared(threshold)
    cbs.set(el, callback)
    observer.observe(el)
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (!el) return
    const shared = cache.get(threshold)
    if (!shared) return
    shared.observer.unobserve(el)
    shared.cbs.delete(el)
  })
}
