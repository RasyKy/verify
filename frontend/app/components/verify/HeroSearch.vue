<script setup lang="ts">
/**
 * The large certificate-ID search bar.
 *
 * Extracted from the landing hero so /verify can present the exact same
 * control. Someone who lands on the marketing page and someone who was handed
 * a bare /verify link are doing the identical job, and two hand-rolled search
 * bars would have drifted apart the first time either was touched.
 *
 * Submitting is the parent's business — this only guards the empty case, which
 * it answers with a short shake rather than an error message, because an empty
 * submit is a slip and not something worth colouring red.
 */
const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Field id — must be unique if two of these ever share a page. */
    inputId?: string
    placeholder?: string
    /**
     * Tracks the pointer parallax the landing hero sets on an ancestor
     * (--mx / --my). Off everywhere else: there is nothing to tilt against on
     * a plain page, and a bar that leans on its own looks broken.
     */
    tilt?: boolean
    autofocus?: boolean
  }>(),
  {
    inputId: 'cert-id-search',
    placeholder: 'Paste a certificate ID…',
    tilt: false,
    autofocus: false,
  },
)

const emit = defineEmits<{ submit: [id: string] }>()

const focused = ref(false)
const invalid = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

let shakeTimer: ReturnType<typeof setTimeout> | undefined

function onSubmit() {
  const id = model.value.trim()
  if (!id) {
    invalid.value = true
    clearTimeout(shakeTimer)
    shakeTimer = setTimeout(() => (invalid.value = false), 500)
    return
  }
  emit('submit', id)
}

// The timer outlives a navigation away from the page otherwise, and fires
// against a torn-down component.
onBeforeUnmount(() => clearTimeout(shakeTimer))

onMounted(() => {
  if (props.autofocus) inputRef.value?.focus()
})
</script>

<template>
  <form
    class="search-3d"
    :class="{
      'search-3d--tilt': tilt,
      'search-3d--focused': focused,
      'search-3d--invalid': invalid,
    }"
    role="search"
    @submit.prevent="onSubmit"
  >
    <label class="sr-only" :for="inputId">Certificate ID</label>
    <div class="search-shell">
      <UIcon name="i-heroicons-magnifying-glass" class="search-icon" />
      <input
        :id="inputId"
        ref="inputRef"
        v-model="model"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        @focus="focused = true"
        @blur="focused = false"
      />
      <button type="submit" class="search-btn">
        <span class="search-btn-text">Verify</span>
        <UIcon name="i-heroicons-arrow-right" class="search-btn-icon" />
      </button>
    </div>
  </form>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.search-3d {
  width: 100%;
  max-width: 620px;
  transform-style: preserve-3d;
}

/* Tilt tracks the pointer, but only half as hard as the cards behind it. */
.search-3d--tilt {
  transform:
    rotateX(calc(var(--my, 0) * -1.6deg))
    rotateY(calc(var(--mx, 0) * 2deg));
  transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Focus kills the tilt outright — nothing should move while someone types. */
.search-3d--tilt.search-3d--focused {
  transform: none;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 72px;
  padding: 0 10px 0 22px;
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  box-shadow:
    0 1px 2px rgba(55, 53, 47, 0.04),
    0 22px 48px -24px rgba(10, 92, 82, 0.40);
  transition: border-color 200ms ease, box-shadow 300ms ease, transform 300ms ease;
}

.search-3d--focused .search-shell {
  border-color: var(--accent);
  box-shadow:
    0 0 0 4px var(--accent-light),
    0 26px 56px -22px rgba(10, 92, 82, 0.50);
  transform: translateY(-2px);
}

.search-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 17px;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 13px;
  background: var(--grad-brand);
  color: #fff;
  font-family: inherit;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-tile);
  transition: transform 150ms ease, box-shadow 200ms ease;
}

.search-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px -12px rgba(10, 92, 82, 0.7);
}

.search-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.search-btn-icon {
  width: 17px;
  height: 17px;
  transition: transform 150ms ease;
}

.search-btn:hover .search-btn-icon {
  transform: translateX(3px);
}

/* Empty submit: one short shake, no red text. */
@media (prefers-reduced-motion: no-preference) {
  .search-3d--invalid .search-shell {
    animation: nudge 420ms ease;
  }

  @keyframes nudge {
    0%, 100% { transform: translateX(0); }
    22%      { transform: translateX(-7px); }
    44%      { transform: translateX(6px); }
    68%      { transform: translateX(-3px); }
  }
}

.search-3d--invalid .search-shell {
  border-color: var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .search-3d--tilt {
    transform: none;
    transition: none;
  }

  .search-btn:hover,
  .search-btn:hover .search-btn-icon,
  .search-3d--focused .search-shell {
    transform: none;
  }
}

@media (max-width: 620px) {
  .search-shell {
    height: auto;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px;
    border-radius: 16px;
  }

  .search-input {
    height: 34px;
    flex-basis: calc(100% - 34px);
    font-size: 16px; /* iOS zooms below 16 */
  }

  .search-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
