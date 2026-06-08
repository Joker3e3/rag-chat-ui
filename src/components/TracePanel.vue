<script setup>
import { computed } from 'vue'

const props = defineProps({
  workflowId: {
    type: String,
    default: '',
  },
  workflowStatus: {
    type: String,
    default: '',
  },
  executionStatus: {
    type: String,
    default: '',
  },
  duration: {
    type: [String, Number],
    default: '',
  },
  steps: {
    type: Array,
    default: () => [],
  },
  toolCalls: {
    type: Array,
    default: () => [],
  },
  rawTrace: {
    type: [Object, Array],
    default: null,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  loaded: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

defineEmits(['toggle'])

const STEP_KEYS = ['steps', 'workflow_steps', 'workflowSteps', 'nodes']
const TOOL_CALL_KEYS = ['tool_calls', 'toolCalls', 'tool_call_records', 'toolCallRecords']

const normalizedWorkflowStatus = computed(() => props.workflowStatus || props.executionStatus || 'unknown')

const normalizedExecutionStatus = computed(() => props.executionStatus || props.workflowStatus || 'unknown')

const asArray = (value) => {
  return Array.isArray(value) ? value : []
}

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const traceSources = computed(() => {
  const raw = props.rawTrace

  if (!isObject(raw)) {
    return []
  }

  return [raw, raw.trace, raw.workflow_trace, raw.execution_trace, raw.data].filter(isObject)
})

const firstPresent = (source, keys) => {
  if (!source) {
    return undefined
  }

  for (const key of keys) {
    const value = source[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return undefined
}

const firstText = (source, keys, fallback = '') => {
  const value = firstPresent(source, keys)

  if (value === undefined) {
    return fallback
  }

  return String(value)
}

const extractArrayByKeys = (sources, keys) => {
  for (const source of sources) {
    for (const key of keys) {
      if (Array.isArray(source[key])) {
        return source[key]
      }
    }
  }

  return []
}

const statusTone = (status) => {
  const value = String(status || '').toLowerCase()

  if (value.includes('success') || value.includes('complete') || value.includes('approved')) {
    return 'success'
  }

  if (value.includes('fail') || value.includes('error') || value.includes('reject')) {
    return 'failed'
  }

  if (value.includes('running') || value.includes('processing') || value.includes('progress')) {
    return 'running'
  }

  return 'pending'
}

const statusTagType = (status) => {
  const tagTypes = {
    success: 'success',
    failed: 'danger',
    running: 'primary',
    pending: 'info',
  }

  return tagTypes[statusTone(status)]
}

const statusLabel = computed(() => {
  const tone = statusTone(normalizedWorkflowStatus.value)
  const labels = {
    success: '已完成',
    failed: '执行失败',
    running: '运行中',
    pending: '执行链路',
  }

  return labels[tone]
})

const toDurationMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const msMatch = trimmed.match(/^([\d.]+)\s*ms$/i)

  if (msMatch) {
    return Number(msMatch[1])
  }

  const secondMatch = trimmed.match(/^([\d.]+)\s*s$/i)

  if (secondMatch) {
    return Number(secondMatch[1]) * 1000
  }

  const numericValue = Number(trimmed)

  return Number.isFinite(numericValue) ? numericValue : null
}

const formatDurationMs = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }

  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`
}

const parseTimestampMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10000000000 ? value * 1000 : value
  }

  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? null : timestamp
}

const formatItemDuration = (item) => {
  const directDuration = firstPresent(item, ['duration_ms', 'duration'])

  if (directDuration !== undefined) {
    const durationMs = toDurationMs(directDuration)

    return durationMs === null ? String(directDuration) : formatDurationMs(durationMs)
  }

  const startedAt = parseTimestampMs(firstPresent(item, ['started_at', 'start_time']))
  const completedAt = parseTimestampMs(firstPresent(item, ['completed_at', 'finished_at', 'ended_at']))

  if (startedAt !== null && completedAt !== null) {
    return formatDurationMs(Math.max(completedAt - startedAt, 0))
  }

  return '-'
}

const sourceSteps = computed(() => {
  if (props.steps.length) {
    return props.steps
  }

  if (Array.isArray(props.rawTrace)) {
    return props.rawTrace
  }

  return extractArrayByKeys(traceSources.value, STEP_KEYS)
})

const normalizedSteps = computed(() => {
  return sourceSteps.value.map((step, index) => {
    const status = firstText(step, ['status', 'execution_status', 'state'], 'unknown')

    return {
      id: firstPresent(step, ['id', 'step_id', 'node_id']) || `${index}-${firstText(step, ['node_name', 'name', 'step_name'], 'step')}`,
      order: firstPresent(step, ['step_order', 'order', 'index', 'sequence']) || index + 1,
      name: firstText(step, ['node_name', 'name', 'step_name'], `step_${index + 1}`),
      status,
      tone: statusTone(status),
      duration: formatItemDuration(step),
      raw: step,
    }
  })
})

const topLevelToolCalls = computed(() => {
  if (props.toolCalls.length) {
    return props.toolCalls
  }

  return extractArrayByKeys(traceSources.value, TOOL_CALL_KEYS)
})

const nestedToolCalls = computed(() => {
  return sourceSteps.value.flatMap((step) => {
    const toolCalls = Array.isArray(step?.tool_calls) ? step.tool_calls : step?.toolCalls

    return asArray(toolCalls)
  })
})

const allToolCalls = computed(() => {
  const seenIds = new Set()
  const seenObjects = new WeakSet()

  return [...topLevelToolCalls.value, ...nestedToolCalls.value].filter((tool) => {
    if (!tool || typeof tool !== 'object') {
      return false
    }

    const stableId = firstPresent(tool, ['id', 'tool_call_id', 'call_id', 'uuid'])

    if (stableId !== undefined) {
      if (seenIds.has(stableId)) {
        return false
      }

      seenIds.add(stableId)
      return true
    }

    if (seenObjects.has(tool)) {
      return false
    }

    seenObjects.add(tool)
    return true
  })
})

const groupedToolCalls = computed(() => {
  const groups = new Map()

  allToolCalls.value.forEach((tool, index) => {
    const name = firstText(
      tool,
      ['tool_name', 'toolName', 'name', 'tool', 'function_name', 'functionName'],
      `tool_call_${index + 1}`,
    )

    if (!groups.has(name)) {
      groups.set(name, {
        name,
        calls: [],
      })
    }

    const status = firstText(tool, ['status', 'execution_status', 'state'], 'unknown')

    groups.get(name).calls.push({
      id: firstPresent(tool, ['id', 'tool_call_id', 'call_id', 'uuid']) || `${name}-${index}`,
      order: groups.get(name).calls.length + 1,
      status,
      duration: formatItemDuration(tool),
      raw: tool,
    })
  })

  return Array.from(groups.values())
})

const formattedDuration = computed(() => {
  if (props.duration === '' || props.duration === null || props.duration === undefined) {
    return '-'
  }

  const durationMs = toDurationMs(props.duration)

  return durationMs === null ? String(props.duration) : formatDurationMs(durationMs)
})

const hasDetails = computed(() => normalizedSteps.value.length > 0 || groupedToolCalls.value.length > 0)

const totalToolCalls = computed(() => allToolCalls.value.length)

const rawTraceText = computed(() => {
  const raw = props.rawTrace || {
    workflow_id: props.workflowId,
    workflow_status: props.workflowStatus,
    execution_status: props.executionStatus,
    duration: props.duration,
    steps: sourceSteps.value,
    tool_calls: allToolCalls.value,
  }

  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return 'Raw trace JSON is not serializable.'
  }
})
</script>

<template>
  <section class="trace-panel" aria-label="执行链路">
    <div class="trace-header">
      <div>
        <div class="trace-title">执行链路（{{ statusLabel }}）</div>
        <div v-if="workflowId" class="trace-id">{{ workflowId }}</div>
      </div>
      <el-tag :type="statusTagType(normalizedExecutionStatus)" effect="light" size="small">
        {{ normalizedExecutionStatus }}
      </el-tag>
    </div>

    <div class="trace-summary">
      <div class="summary-item">
        <span>Workflow Status</span>
        <strong>{{ normalizedWorkflowStatus }}</strong>
      </div>
      <div class="summary-item">
        <span>总耗时</span>
        <strong>{{ formattedDuration }}</strong>
      </div>
      <div class="summary-item">
        <span>Nodes</span>
        <strong>{{ normalizedSteps.length }}</strong>
      </div>
      <div class="summary-item">
        <span>Tool Calls</span>
        <strong>{{ totalToolCalls }}</strong>
      </div>
    </div>

    <button class="trace-toggle" type="button" @click="$emit('toggle')">
      {{ expanded ? '收起执行详情 ▲' : '查看执行详情 ▼' }}
    </button>

    <div v-if="expanded" class="trace-details">
      <div v-if="loading" class="trace-empty">正在加载执行链路...</div>
      <div v-else-if="error" class="trace-error">{{ error }}</div>
      <div v-else-if="loaded && !hasDetails" class="trace-empty">暂无执行链路数据</div>
      <template v-else>
        <section v-if="normalizedSteps.length" class="trace-section">
          <div class="trace-section-header">
            <h3>Workflow Flow</h3>
            <span>{{ normalizedSteps.length }} nodes</span>
          </div>

          <div class="trace-flow" role="list">
            <div
              v-for="(step, index) in normalizedSteps"
              :key="step.id"
              class="trace-flow-item"
              role="listitem"
            >
              <article class="trace-node-card" :class="`trace-node-${step.tone}`">
                <div class="trace-node-top">
                  <span class="trace-node-order">#{{ step.order }}</span>
                  <el-tag :type="statusTagType(step.status)" effect="light" size="small">
                    {{ step.status }}
                  </el-tag>
                </div>
                <div class="trace-node-name" :title="step.name">{{ step.name }}</div>
                <div class="trace-node-duration">{{ step.duration }}</div>
              </article>
              <span v-if="index < normalizedSteps.length - 1" class="trace-arrow">→</span>
            </div>
          </div>
        </section>

        <section v-if="groupedToolCalls.length" class="trace-section">
          <div class="trace-section-header">
            <h3>Grouped Tool Calls</h3>
            <span>{{ groupedToolCalls.length }} tools / {{ totalToolCalls }} calls</span>
          </div>

          <div class="tool-call-grid">
            <article v-for="group in groupedToolCalls" :key="group.name" class="tool-call-card">
              <div class="tool-call-head">
                <strong :title="group.name">{{ group.name }}</strong>
                <span>count: {{ group.calls.length }}</span>
              </div>
              <div class="tool-call-list">
                <div v-for="call in group.calls" :key="call.id" class="tool-call-row">
                  <span class="tool-call-index">#{{ call.order }}</span>
                  <span class="tool-call-duration">{{ call.duration }}</span>
                  <el-tag :type="statusTagType(call.status)" effect="light" size="small">
                    {{ call.status }}
                  </el-tag>
                </div>
              </div>
            </article>
          </div>
        </section>

        <details class="trace-raw">
          <summary>Raw trace JSON</summary>
          <pre>{{ rawTraceText }}</pre>
        </details>
      </template>
    </div>
  </section>
</template>

<style scoped>
.trace-panel {
  margin-top: 18px;
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  background: #fbfcfe;
  padding: 14px;
}

.trace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.trace-title {
  color: #111827;
  font-size: 15px;
  font-weight: 800;
}

.trace-id {
  margin-top: 4px;
  color: #667085;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.trace-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.summary-item {
  min-width: 0;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
}

.summary-item span {
  display: block;
  color: #667085;
  font-size: 12px;
}

.summary-item strong {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #1d2939;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-toggle {
  margin-top: 12px;
  border: none;
  background: transparent;
  color: #175cd3;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  padding: 0;
}

.trace-details {
  margin-top: 12px;
  border-top: 1px solid #eaecf0;
  padding-top: 12px;
}

.trace-empty {
  color: #667085;
  font-size: 14px;
}

.trace-error {
  color: #b42318;
  font-size: 14px;
  line-height: 1.5;
}

.trace-section {
  margin-top: 12px;
}

.trace-section:first-child {
  margin-top: 0;
}

.trace-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.trace-section-header h3 {
  margin: 0;
  color: #344054;
  font-size: 13px;
  font-weight: 800;
}

.trace-section-header span {
  color: #667085;
  font-size: 12px;
}

.trace-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.trace-flow-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.trace-node-card {
  width: 146px;
  min-height: 88px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
  padding: 9px;
}

.trace-node-success {
  border-color: #abefc6;
  background: #f6fef9;
}

.trace-node-failed {
  border-color: #fecdca;
  background: #fffbfa;
}

.trace-node-running {
  border-color: #b2ddff;
  background: #f5fbff;
}

.trace-node-pending {
  border-color: #d0d5dd;
  background: #f9fafb;
}

.trace-node-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.trace-node-order {
  color: #344054;
  font-size: 12px;
  font-weight: 800;
}

.trace-node-name {
  display: -webkit-box;
  min-height: 32px;
  margin-top: 8px;
  overflow: hidden;
  color: #101828;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.trace-node-duration {
  margin-top: 7px;
  color: #475467;
  font-size: 12px;
  font-weight: 800;
}

.trace-arrow {
  color: #98a2b3;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.tool-call-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.tool-call-card {
  min-width: 0;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
}

.tool-call-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.tool-call-head strong {
  overflow: hidden;
  color: #101828;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-head span {
  flex-shrink: 0;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.tool-call-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.tool-call-row {
  display: grid;
  grid-template-columns: 28px minmax(54px, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  color: #344054;
  font-size: 12px;
}

.tool-call-index {
  color: #667085;
  font-weight: 800;
}

.tool-call-duration {
  font-weight: 800;
}

.trace-raw {
  margin-top: 12px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
  color: #344054;
  font-size: 13px;
}

.trace-raw summary {
  cursor: pointer;
  font-weight: 800;
  padding: 9px 10px;
}

.trace-raw pre {
  max-height: 300px;
  margin: 0;
  overflow: auto;
  border-top: 1px solid #eef0f4;
  background: #f8fafc;
  color: #101828;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 10px;
}

@media (max-width: 760px) {
  .trace-summary {
    grid-template-columns: 1fr 1fr;
  }

  .trace-node-card {
    width: 132px;
  }

  .trace-arrow {
    display: none;
  }
}
</style>
