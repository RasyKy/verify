<template>
  <section v-if="institutions?.length" class="trust-bar reveal">
    <div class="trust-inner">
      <p class="trust-label">Trusted by institutions worldwide</p>

      <!--
        The rail scrolls because the registry outgrew a single static row: ten
        marks wrap to three cramped lines on a laptop. Everything that makes
        that readable lives here — the mask fades both ends so logos enter and
        leave instead of being chopped by the edge, and hovering pauses the
        track so someone can actually look at a mark they recognise.
      -->
      <div
        class="trust-marquee"
        :style="{ '--marquee-duration': `${duration}s` }"
      >
        <div class="trust-track">
          <!--
            Two identical passes. The animation travels exactly one pass width
            (-50%) and snaps back, so the second pass is what occupies the
            viewport at the moment the first one resets — the seam never shows.
            Only the first pass is exposed to assistive tech.
          -->
          <ul
            v-for="pass in 2"
            :key="pass"
            class="trust-pass"
            :aria-hidden="pass === 2 ? 'true' : undefined"
          >
            <li
              v-for="(org, i) in marqueeItems"
              :key="`${pass}-${org.id}-${i}`"
              :title="org.name"
              class="trust-item"
            >
              <!-- Real mark where the institution has one; initials are the
                   fallback, not the design. -->
              <img
                v-if="org.logoUrl"
                :src="org.logoUrl"
                :alt="org.name"
                class="trust-mark"
                loading="lazy"
                decoding="async"
              />
              <span v-else class="trust-logo">{{ acronymOf(org.name) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { institutions } = useRegistry()

/**
 * A scrolling rail only reads as continuous if one pass is wider than the
 * viewport — with three institutions the track would visibly run out and jump.
 * Repeating the registry until a pass holds at least this many tiles keeps the
 * loop seamless no matter how few organizations are accredited today.
 */
const MIN_TILES_PER_PASS = 10

const marqueeItems = computed(() => {
  const list = institutions.value ?? []
  if (!list.length) return []
  const repeats = Math.ceil(MIN_TILES_PER_PASS / list.length)
  return Array.from({ length: repeats }, () => list).flat()
})

/**
 * Duration scales with tile count so the rail moves at one constant speed —
 * a fixed duration would race through a long registry and crawl through a
 * short one.
 */
const SECONDS_PER_TILE = 4.5
const duration = computed(() =>
  Math.round(marqueeItems.value.length * SECONDS_PER_TILE),
)

// Institutions only have a full `name` in the schema — no stored short form —
// so derive a compact acronym for this bar's existing badge-style look.
// Small connector words are skipped so e.g. "Delta Polytechnic" -> "DP", not "DPO".
const STOP_WORDS = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'le', 'des', 'du'])

function acronymOf(name: string) {
  const initials = name
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  if (initials.length >= 2) return initials.slice(0, 6)
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || name.slice(0, 4)
}
</script>

<style scoped>
.trust-bar {
  background: var(--surface);
  padding: 72px 0;
}

.trust-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

/* Same size/weight as every other section headline on the page
   (.section-headline in HowItWorks/FeaturesSection/FaqSection/etc.) — a real
   heading, not a muted caption, so the rail reads as a stated claim rather
   than fine print. */
.trust-label {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.2;
  text-align: center;
  margin: 0;
  padding: 0 40px;
}

/* ── The rail ──
   Full-bleed on purpose: the fade needs room to happen, and a marquee that
   stops short of the viewport edge looks like a bug rather than a rail. */
.trust-marquee {
  width: 100%;
  overflow: hidden;
  /* Both ends dissolve instead of cutting. -webkit- is still required for
     Safari, which has no unprefixed mask-image on this property. */
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 9%,
    #000 91%,
    transparent 100%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 9%,
    #000 91%,
    transparent 100%
  );
}

.trust-track {
  display: flex;
  width: max-content;
  animation: trust-scroll var(--marquee-duration, 45s) linear infinite;
}

/* Left to right: start one full pass behind and travel forward to zero. */
@keyframes trust-scroll {
  from {
    transform: translate3d(-50%, 0, 0);
  }
  to {
    transform: translate3d(0, 0, 0);
  }
}

/* Let someone stop the rail on a mark they want to read. */
.trust-marquee:hover .trust-track,
.trust-marquee:focus-within .trust-track {
  animation-play-state: paused;
}

/* The trailing padding matches `gap` exactly, so the space between the last
   tile of one pass and the first tile of the next is identical to the spacing
   inside a pass — otherwise the seam is visible as a rhythm break. It also
   keeps a pass's width a clean multiple, which is what makes -50% land on a
   perfect loop. */
.trust-pass {
  display: flex;
  align-items: center;
  gap: 32px;
  margin: 0;
  padding: 0 32px 0 0;
  list-style: none;
}

/* Fixed width, not shrink-to-fit. The registry's marks range from a wide
   wordmark to a circular seal, and sizing each tile to its own logo made the
   rail lurch between narrow and wide tiles as it scrolled. No card chrome —
   just the mark itself, floating on the band. */
.trust-item {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 180px;
}

/* One box for every mark. `contain` letterboxes inside it, so a square seal
   gets the full height instead of being scaled down to the width a wordmark
   happens to need. */
.trust-mark {
  height: 56px;
  width: auto;
  max-width: 180px;
  object-fit: contain;
  display: block;
}

.trust-logo {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  font-family: ui-monospace, 'Cascadia Code', monospace;
}

/* ── Reduced motion ──
   No crawl. The rail becomes a plain scrollable strip the reader drives. */
@media (prefers-reduced-motion: reduce) {
  .trust-track {
    animation: none;
  }

  .trust-marquee {
    overflow-x: auto;
  }

  /* The duplicate pass exists only to hide the loop seam; without motion it
     is just the same logos twice. */
  .trust-pass[aria-hidden='true'] {
    display: none;
  }
}

@media (max-width: 640px) {
  .trust-bar {
    padding: 48px 0;
  }

  .trust-label {
    font-size: 26px;
    padding: 0 20px;
  }

  .trust-pass {
    gap: 14px;
    padding-right: 14px;
  }

  .trust-item {
    width: 150px;
  }

  .trust-mark {
    height: 46px;
    max-width: 150px;
  }
}
</style>
