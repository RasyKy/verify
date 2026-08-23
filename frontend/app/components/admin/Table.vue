<script setup lang="ts">
export interface Column {
  key: string
  label: string
  sortable?: boolean
  hideMobile?: boolean
}

const props = defineProps<{
  columns: Column[]
  rows: Record<string, any>[]
  emptyMessage?: string
  clickable?: boolean
}>()

const emit = defineEmits<{
  'row-click': [row: Record<string, any>]
}>()

const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows
  return [...props.rows].sort((a, b) => {
    const va = String(a[sortKey.value] ?? '')
    const vb = String(b[sortKey.value] ?? '')
    const cmp = va.localeCompare(vb, undefined, { numeric: true })
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})
</script>

<template>
  <div class="table-wrap">
    <table class="admin-table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="['th', { 'col-sortable': col.sortable, 'col-hide-mobile': col.hideMobile }]"
            @click="col.sortable ? toggleSort(col.key) : undefined"
          >
            <span class="th-inner">
              {{ col.label }}
              <UIcon
                v-if="col.sortable"
                :name="
                  sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'i-heroicons-bars-arrow-up'
                      : 'i-heroicons-bars-arrow-down'
                    : 'i-heroicons-chevron-up-down'
                "
                class="sort-caret"
                :class="{ 'sort-caret--active': sortKey === col.key }"
              />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!sortedRows.length">
          <td :colspan="columns.length" class="empty-cell">
            <div class="empty-state">
              <UIcon name="i-heroicons-inbox" class="empty-icon" />
              <p>{{ emptyMessage ?? 'No records found' }}</p>
            </div>
          </td>
        </tr>
        <tr
          v-else
          v-for="row in sortedRows"
          :key="row.id ?? JSON.stringify(row)"
          :class="['tr', { 'tr-clickable': clickable }]"
          @click="clickable && emit('row-click', row)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="td"
            :class="{ 'col-hide-mobile': col.hideMobile }"
          >
            <slot :name="`cell-${col.key}`" :value="row[col.key]" :row="row">
              <span class="cell-text">{{ row[col.key] ?? '—' }}</span>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  overflow-x: auto;
  background: var(--surface);
  box-shadow: var(--shadow-panel);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}

/* Solid dark header band — the row reads as a header at a glance, without
   needing a rule under it to separate it from the first record. */
.th {
  padding: 0 16px;
  height: 46px;
  text-align: left;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.045em;
  text-transform: uppercase;
  color: var(--rail-text);
  background: var(--rail-bg);
  white-space: nowrap;
  user-select: none;
}

.th .sort-caret {
  color: var(--rail-text-dim);
}

.th .sort-caret--active {
  color: #7FD3C5;
}

.col-sortable {
  cursor: pointer;
  transition: color var(--transition-fast);
}

.col-sortable:hover {
  color: var(--rail-text-strong);
}

.th-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sort-caret {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.sort-caret--active {
  color: var(--accent);
}

.tr {
  border-bottom: 1px solid var(--border);
  transition: background-color var(--transition-fast);
}

.tr:last-child {
  border-bottom: none;
}

.tr:hover {
  background: var(--surface-hover);
}

.tr-clickable {
  cursor: pointer;
}

.tr-clickable:hover {
  box-shadow: inset 2px 0 0 var(--accent);
}

.td {
  padding: 0 16px;
  height: 52px;
  font-size: 13px;
  color: var(--text-primary);
  vertical-align: middle;
}

.cell-text {
  color: var(--text-primary);
}

.empty-cell {
  padding: 48px 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
}

.empty-icon {
  width: 32px;
  height: 32px;
}

.empty-state p {
  font-size: 13px;
  margin: 0;
}

@media (max-width: 640px) {
  .col-hide-mobile {
    display: none;
  }
}
</style>
