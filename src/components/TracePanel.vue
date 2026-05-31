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

const normalizedWorkflowStatus = computed(() => props.workflowStatus || props.executionStatus || 'Unknown')

const normalizedExecutionStatus = computed(() => props.executionStatus || props.workflowStatus || 'Unknown')

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

  if (value.includes('wait') || value.includes('pending') || value.includes('human')) {
    return 'waiting'
  }

  return 'neutral'
}

const statusLabel = computed(() => {
  const tone = statusTone(normalizedWorkflowStatus.value)
  const labels = {
    success: '已完成',
    failed: '失败',
    running: '运行中',
    waiting: '等待中',
    neutral: '执行链路',
  }

  return labels[tone]
})

const formattedDuration = computed(() => {
  if (props.duration === '' || props.duration === null || props.duration === undefined) {
    return '-'
  }

  if (typeof props.duration === 'number') {
    if (props.duration >= 1000) {
      return `${(props.duration / 1000).toFixed(1)}s`
    }

    return `${props.duration}ms`
  }

  return props.duration
})

const hasDetails = computed(() => props.steps.length > 0 || props.toolCalls.length > 0)

const stepName = (step, fallback) => {
  return step?.node_name || fallback
}

const toolName = (tool, fallback) => {
  return tool?.tool_name || fallback
}

const itemStatus = (item) => {
  return item?.status || 'unknown'
}

const itemDuration = (item) => {
  const value = item?.duration_ms ?? ''

  if (value === '' || value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'number') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`
  }

  return value
}
</script>

<template>
  <section class="trace-panel" aria-label="执行链路">
    <div class="trace-header">
      <div>
        <div class="trace-title">
          执行链路（{{ statusLabel }}）
        </div>
        <div v-if="workflowId" class="trace-id">{{ workflowId }}</div>
      </div>
      <span class="status-pill" :class="`status-${statusTone(normalizedExecutionStatus)}`">
        {{ normalizedExecutionStatus }}
      </span>
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
        <span>Node</span>
        <strong>{{ steps.length }}</strong>
      </div>
      <div class="summary-item">
        <span>Tool Calls</span>
        <strong>{{ toolCalls.length }}</strong>
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
        <div v-if="workflowId" class="trace-tree-block">
          <div class="tree-heading">Workflow</div>
          <div class="tree-line">└─ {{ workflowId }}</div>
        </div>

        <div v-for="(step, index) in steps" :key="step.id || index" class="trace-tree-block">
          <div class="tree-heading">Step {{ step.step_order || index + 1 }}</div>
          <div class="tree-line">└─ {{ stepName(step, `step_${index + 1}`) }}</div>
          <div class="tree-meta">
            <span>status:</span>
            <strong :class="`text-${statusTone(itemStatus(step))}`">{{ itemStatus(step) }}</strong>
          </div>
          <div class="tree-meta">
            <span>duration:</span>
            <strong>{{ itemDuration(step) }}</strong>
          </div>
        </div>

        <div v-if="toolCalls.length" class="trace-tree-block">
          <div class="tree-heading">Tool Calls</div>
          <div v-for="(tool, index) in toolCalls" :key="tool.id || index" class="tool-call">
            <div class="tree-line">└─ {{ toolName(tool, `tool_call_${index + 1}`) }}</div>
            <div class="tree-meta">
              <span>status:</span>
              <strong :class="`text-${statusTone(itemStatus(tool))}`">{{ itemStatus(tool) }}</strong>
            </div>
            <div class="tree-meta">
              <span>duration:</span>
              <strong>{{ itemDuration(tool) }}</strong>
            </div>
          </div>
        </div>
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
  padding: 16px;
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
  font-weight: 700;
}

.trace-id {
  margin-top: 4px;
  color: #667085;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.status-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.status-success {
  background: #ecfdf3;
  color: #027a48;
}

.status-failed {
  background: #fef3f2;
  color: #b42318;
}

.status-running {
  background: #eff8ff;
  color: #175cd3;
}

.status-waiting {
  background: #fffaeb;
  color: #b54708;
}

.status-neutral {
  background: #f2f4f7;
  color: #475467;
}

.trace-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.summary-item {
  min-width: 0;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
}

.summary-item span {
  display: block;
  color: #667085;
  font-size: 12px;
}

.summary-item strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #1d2939;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-toggle {
  margin-top: 14px;
  border: none;
  background: transparent;
  color: #175cd3;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 0;
}

.trace-details {
  margin-top: 14px;
  border-top: 1px solid #eaecf0;
  padding-top: 14px;
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

.trace-tree-block {
  margin-top: 12px;
  border-left: 2px solid #e4e7ec;
  padding-left: 12px;
}

.trace-tree-block:first-child {
  margin-top: 0;
}

.tree-heading {
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.tree-line {
  margin-top: 6px;
  color: #101828;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-all;
}

.tree-meta {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
}

.tree-meta strong {
  color: #344054;
}

.tool-call {
  margin-top: 10px;
}

.text-success {
  color: #027a48 !important;
}

.text-failed {
  color: #b42318 !important;
}

.text-running {
  color: #175cd3 !important;
}

.text-waiting {
  color: #b54708 !important;
}

@media (max-width: 760px) {
  .trace-summary {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
