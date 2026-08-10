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
              <span v-if="col.sortable" class="sort-caret">
                <template v-if="sortKey === col.key">{{ sortDir === 'asc' ? '↑' : '↓' }}</template>
                <template v-else>↕</template>
              </span>
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
  border-radius: 8px;
  overflow: hidden;
  overflow-x: auto;
  box-shadow: var(--shadow-card);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}

.th {
  padding: 0 16px;
  height: 40px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface-hover);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  user-select: none;
}

.col-sortable {
  cursor: pointer;
}

.col-sortable:hover {
  color: var(--text-primary);
}

.th-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sort-caret {
  font-size: 10px;
  color: var(--text-tertiary);
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
