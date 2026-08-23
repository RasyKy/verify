/**
 * Scroll-reveal for `.reveal` sections.
 *
 * Two rules this has to obey, both learned the hard way:
 *
 *   1. Content is visible by default. The hidden state is applied only once
 *      this composable has run and confirmed IntersectionObserver exists —
 *      that is what `.reveal-ready` on <html> means. Hiding first and
 *      revealing later inverts the failure mode: any slip and the page is
 *      blank rather than merely un-animated.
 *
 *   2. Late arrivals get observed too. The landing page renders its sections
 *      through `Lazy*` components with deferred hydration, and TrustBar only
 *      renders once the registry responds. A one-shot querySelectorAll at
 *      mount misses every element that appears after it, and those sections
 *      then stay at opacity 0 forever.
 */
export function useScrollReveal() {
  if (import.meta.server) return

  onMounted(() => {
    // No IntersectionObserver → never hide anything, just show the page.
    if (!('IntersectionObserver' in window)) return

    const root = document.documentElement
    root.classList.add('reveal-ready')

    let everFired = false

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          everFired = true
          entry.target.classList.add('reveal--visible')
          io.unobserve(entry.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )

    const observe = (el: Element) => {
      if (!el.classList.contains('reveal--visible')) io.observe(el)
    }

    document.querySelectorAll('.reveal').forEach(observe)

    // Catch sections that mount after this point.
    const mo = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.classList.contains('reveal')) observe(node)
          node.querySelectorAll?.('.reveal').forEach(observe)
        }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })

    /*
     * Self-healing failsafe. Sections above the fold should reveal almost
     * immediately; if nothing at all has fired by now the observer is not
     * working in this engine, and the hidden state is doing real damage —
     * so drop it entirely and show the page unanimated. Costs an effect,
     * never the content.
     */
    const failsafe = setTimeout(() => {
      if (everFired) return
      io.disconnect()
      mo.disconnect()
      root.classList.remove('reveal-ready')
    }, 1200)

    onBeforeUnmount(() => {
      clearTimeout(failsafe)
      io.disconnect()
      mo.disconnect()
      root.classList.remove('reveal-ready')
    })
  })
}
