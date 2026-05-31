<script setup>
import { computed, onUnmounted, ref } from 'vue'
import axios from 'axios'
import MarkdownIt from 'markdown-it'
import TracePanel from '../components/TracePanel.vue'

const CAREER_AGENT_URL = 'http://127.0.0.1:8010/career_agent/analyze'
const CAREER_CONFIRM_URL = 'http://127.0.0.1:8010/career_agent/confirm'
const CAREER_RUNS_BASE_URL = 'http://127.0.0.1:8010/career_agent/runs'
const md = new MarkdownIt()

const sessionId = ref('user_001')
const userId = ref('Joker3e')
const jobDescription = ref('')
const resumeText = ref('')
const report = ref('')
const matchScore = ref('')
const statusMessage = ref('')
const loading = ref(false)
const analyzeResponded = ref(false)
const error = ref('')
const workflowId = ref('')
const confirmationId = ref('')
const workflowStatus = ref('')
const workflowDuration = ref('')
const executionStatus = ref('')
const traceExpanded = ref(false)
const traceLoaded = ref(false)
const traceLoading = ref(false)
const traceError = ref('')
const traceSteps = ref([])
const traceToolCalls = ref([])
const confirming = ref(false)
const confirmationStatus = ref('')
const confirmationMessage = ref('')
const confirmationWorkflowStatus = ref('')
const confirmationError = ref('')
let pollingTimer = null
let pollingRequestInFlight = false

const shouldShowConfirmation = computed(() => {
  return workflowStatus.value === 'waiting_human_confirmation' && workflowId.value && confirmationId.value
})

const shouldShowTrace = computed(() => {
  return Boolean(
    workflowId.value ||
    workflowStatus.value ||
    workflowDuration.value ||
    executionStatus.value ||
    traceSteps.value.length ||
    traceToolCalls.value.length,
  )
})

const renderedReport = computed(() => {
  return md.render(report.value || '')
})

const resetTrace = () => {
  traceExpanded.value = false
  traceLoaded.value = false
  traceLoading.value = false
  traceError.value = ''
  traceSteps.value = []
  traceToolCalls.value = []
}

const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

const resetConfirmation = () => {
  stopPolling()
  workflowId.value = ''
  confirmationId.value = ''
  workflowStatus.value = ''
  workflowDuration.value = ''
  executionStatus.value = ''
  matchScore.value = ''
  statusMessage.value = ''
  resetTrace()
  confirming.value = false
  confirmationStatus.value = ''
  confirmationMessage.value = ''
  confirmationWorkflowStatus.value = ''
  confirmationError.value = ''
}

const applyRunStatus = (data = {}) => {
  workflowId.value = data.workflow_id || workflowId.value
  workflowStatus.value = data.status || ''
  executionStatus.value = data.status || ''
  matchScore.value = data.match_score ?? ''

  if (data.status === 'queued' || data.status === 'running') {
    loading.value = true
    statusMessage.value = '分析任务已提交，正在后台处理中。'
    return
  }

  if (data.status === 'waiting_human_confirmation') {
    stopPolling()
    loading.value = false
    report.value = data.final_report || ''
    confirmationId.value = data.confirmation?.confirmation_id || ''
    confirmationStatus.value = data.confirmation?.status || ''
    confirmationMessage.value = data.confirmation?.message || ''
    statusMessage.value = '分析已完成，等待人工确认。'
    return
  }

  if (data.status === 'completed') {
    stopPolling()
    loading.value = false
    statusMessage.value = '流程已完成。'
    report.value = data.final_report || report.value
    return
  }

  if (data.status === 'failed') {
    stopPolling()
    loading.value = false
    error.value = data.error_message || '分析流程执行失败。'
    statusMessage.value = ''
  }
}

const pollRunStatus = async () => {
  if (!workflowId.value || pollingRequestInFlight) {
    return
  }

  pollingRequestInFlight = true

  try {
    const response = await axios.get(`${CAREER_RUNS_BASE_URL}/${workflowId.value}`)
    applyRunStatus(response.data || {})
  } catch (err) {
    console.error(err)
    stopPolling()
    loading.value = false
    error.value = err.response?.data?.detail || err.message || '查询分析任务状态失败，请稍后重试。'
  } finally {
    pollingRequestInFlight = false
  }
}

const startPolling = () => {
  stopPolling()
  pollingTimer = setInterval(pollRunStatus, 2000)
}

const analyzeCareer = async () => {
  error.value = ''
  report.value = ''
  analyzeResponded.value = false
  resetConfirmation()
  loading.value = true

  try {
    const response = await axios.post(CAREER_AGENT_URL, {
      session_id: sessionId.value,
      user_id: userId.value,
      job_description: jobDescription.value,
      resume_text: resumeText.value,
    })

    analyzeResponded.value = true

    const data = response.data || {}
    workflowId.value = data.workflow_id || ''
    workflowStatus.value = data.workflow_status || 'queued'
    executionStatus.value = workflowStatus.value
    statusMessage.value = data.message || '分析任务已提交，正在后台处理中。'
    loading.value = true

    if (workflowId.value) {
      startPolling()
    } else {
      loading.value = false
      error.value = '分析任务提交失败：后端未返回 workflow_id。'
    }
  } catch (err) {
    console.error(err)
    error.value = err.response?.data?.detail || err.message || '分析失败，请检查后端服务。'
    loading.value = false
  }
}

const confirmCareer = async (action) => {
  if (confirming.value || !workflowId.value || !confirmationId.value) {
    return
  }

  confirmationError.value = ''
  confirming.value = true

  try {
    const response = await axios.post(CAREER_CONFIRM_URL, {
      workflow_id: workflowId.value,
      confirmation_id: confirmationId.value,
      action,
    })

    confirmationStatus.value = response.data.confirmation_status || ''
    confirmationMessage.value = response.data.confirmation_message || ''
    confirmationWorkflowStatus.value = response.data.workflow_status || ''
    workflowStatus.value = response.data.workflow_status || workflowStatus.value
    workflowId.value = response.data.workflow_id || workflowId.value
    confirmationId.value = response.data.confirmation_id || confirmationId.value
    executionStatus.value = response.data.execution_status || workflowStatus.value || executionStatus.value
  } catch (err) {
    console.error(err)
    confirmationError.value = err.response?.data?.detail || err.message || '确认请求失败，请检查后端服务。'
  } finally {
    confirming.value = false
  }
}

const loadTrace = async () => {
  if (!workflowId.value || traceLoading.value) {
    return
  }

  traceError.value = ''
  traceLoading.value = true

  try {
    const response = await axios.get(`${CAREER_RUNS_BASE_URL}/${workflowId.value}/trace`)
    const data = response.data || {}
    traceSteps.value = Array.isArray(data.steps) ? data.steps : []
    traceToolCalls.value = traceSteps.value.flatMap((step) => {
      return Array.isArray(step.tool_calls) ? step.tool_calls : []
    })
    traceLoaded.value = true
  } catch (err) {
    console.error(err)
    traceError.value = err.response?.data?.detail || err.message || '执行链路加载失败，请稍后重试。'
  } finally {
    traceLoading.value = false
  }
}

const toggleTrace = async () => {
  traceExpanded.value = !traceExpanded.value

  if (traceExpanded.value && workflowId.value && !traceLoaded.value && !traceLoading.value) {
    await loadTrace()
  }
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="career-page">
    <section class="career-hero">
      <div>
        <p class="career-kicker">AI Career Analysis Agent</p>
        <h1>CareerAgent</h1>
        <p class="career-subtitle">输入岗位 JD 与简历文本，生成匹配度、证据链与行动建议。</p>
      </div>
      <div class="hero-badge">V3.2 Observability</div>
    </section>

    <section class="career-form">
      <div class="career-inline-grid">
        <div class="career-field">
          <label for="session-id">session_id</label>
          <input id="session-id" v-model="sessionId" type="text" />
        </div>

        <div class="career-field">
          <label for="user-id">user_id</label>
          <input id="user-id" v-model="userId" type="text" />
        </div>
      </div>

      <div class="career-grid">
        <div class="career-field">
          <label for="job-description">岗位 JD</label>
          <textarea id="job-description" v-model="jobDescription" placeholder="请输入岗位 JD 文本"></textarea>
        </div>

        <div class="career-field">
          <label for="resume-text">简历文本</label>
          <textarea id="resume-text" v-model="resumeText" placeholder="请输入简历文本"></textarea>
        </div>
      </div>

      <div class="career-actions">
        <button class="career-submit" :disabled="loading" @click="analyzeCareer">
          {{ loading ? '分析中...' : '开始分析' }}
        </button>
      </div>

      <div v-if="error" class="career-error">{{ error }}</div>
    </section>

    <section class="career-report">
      <div class="career-report-header">
        <div>
          <p class="section-kicker">Analysis Report</p>
          <h2>分析报告</h2>
        </div>
        <div v-if="workflowId" class="workflow-chip">
          <span>workflow_id</span>
          <strong>{{ workflowId }}</strong>
        </div>
      </div>

      <div v-if="statusMessage" class="career-status">
        <span>{{ workflowStatus || 'submitted' }}</span>
        {{ statusMessage }}
      </div>
      <div v-if="matchScore !== ''" class="match-score">
        <span>Match Score</span>
        <strong>{{ matchScore }}</strong>
      </div>
      <div v-if="loading && !analyzeResponded && !report" class="career-empty">正在提交分析任务...</div>
      <div v-else-if="report" class="career-report-content" v-html="renderedReport"></div>
      <div v-if="!loading && !report && !statusMessage && !error" class="career-empty">报告将在分析完成后显示在这里。</div>

      <div v-if="shouldShowConfirmation" class="career-confirm-panel">
        <div>
          <div class="career-confirm-title">Human-in-the-loop 确认</div>
          <div class="career-confirm-desc">请确认是否采用当前分析结果，或返回修改。</div>
        </div>
        <div class="career-confirm-actions">
          <button class="career-confirm-button" :disabled="confirming" @click="confirmCareer('approve')">
            {{ confirming ? '提交中...' : '确认使用' }}
          </button>
          <button class="career-confirm-button career-confirm-secondary" :disabled="confirming"
            @click="confirmCareer('revise')">
            需要修改
          </button>
          <button class="career-confirm-button career-confirm-danger" :disabled="confirming"
            @click="confirmCareer('reject')">
            暂不使用
          </button>
        </div>
        <div v-if="confirmationError" class="career-confirm-error">{{ confirmationError }}</div>
      </div>

      <div v-if="confirmationStatus || confirmationMessage || confirmationWorkflowStatus" class="career-confirm-result">
        <div v-if="confirmationStatus">
          <span>confirmation_status:</span> {{ confirmationStatus }}
        </div>
        <div v-if="confirmationMessage">
          <span>confirmation_message:</span> {{ confirmationMessage }}
        </div>
        <div v-if="confirmationWorkflowStatus">
          <span>workflow_status:</span> {{ confirmationWorkflowStatus }}
        </div>
      </div>

      <TracePanel
        v-if="shouldShowTrace"
        :workflow-id="workflowId"
        :workflow-status="workflowStatus"
        :execution-status="executionStatus"
        :duration="workflowDuration"
        :steps="traceSteps"
        :tool-calls="traceToolCalls"
        :expanded="traceExpanded"
        :loaded="traceLoaded"
        :loading="traceLoading"
        :error="traceError"
        @toggle="toggleTrace"
      />
    </section>
  </div>
</template>

<style scoped>
.career-page {
  min-height: calc(90vh - 68px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.career-hero,
.career-form,
.career-report {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}

.career-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
}

.career-kicker,
.section-kicker {
  margin: 0 0 6px;
  color: #175cd3;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.career-hero h1,
.career-report-header h2 {
  margin: 0;
  color: #101828;
  font-size: 26px;
  line-height: 1.25;
}

.career-subtitle {
  margin: 8px 0 0;
  color: #667085;
  font-size: 15px;
  line-height: 1.6;
}

.hero-badge {
  flex-shrink: 0;
  border: 1px solid #d0d5dd;
  border-radius: 999px;
  background: #f9fafb;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 12px;
}

.career-form,
.career-report {
  padding: 20px;
}

.career-inline-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.career-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.career-field label {
  color: #344054;
  font-size: 14px;
  font-weight: 700;
}

.career-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 16px;
}

.career-field input,
.career-field textarea {
  width: 100%;
  border: 1px solid #d0d5dd;
  border-radius: 10px;
  color: #101828;
  font-size: 15px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.career-field input {
  height: 40px;
  padding: 0 12px;
}

.career-field textarea {
  min-height: 240px;
  padding: 12px;
  resize: vertical;
  font-family: Arial, sans-serif;
}

.career-field input:focus,
.career-field textarea:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
}

.career-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.career-submit {
  min-width: 120px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: #1677ff;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.2s, transform 0.2s;
}

.career-submit:hover:not(:disabled) {
  background: #0958d9;
}

.career-submit:active:not(:disabled) {
  transform: translateY(1px);
}

.career-submit:disabled {
  background: #a0cfff;
  cursor: not-allowed;
}

.career-error {
  margin-top: 14px;
  border: 1px solid #ffccc7;
  border-radius: 10px;
  background: #fff1f0;
  color: #cf1322;
  line-height: 1.5;
  padding: 12px;
}

.career-report {
  flex: 1;
  min-height: 220px;
}

.career-report-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.workflow-chip {
  max-width: 420px;
  border: 1px solid #e4e7ec;
  border-radius: 10px;
  background: #f9fafb;
  padding: 8px 10px;
}

.workflow-chip span {
  display: block;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.workflow-chip strong {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #344054;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.career-report-content {
  color: #303133;
  line-height: 1.7;
}

.career-report-content :deep(h1),
.career-report-content :deep(h2),
.career-report-content :deep(h3),
.career-report-content :deep(h4),
.career-report-content :deep(h5),
.career-report-content :deep(h6) {
  margin: 18px 0 10px;
  color: #1f2937;
  line-height: 1.35;
}

.career-report-content :deep(h1) {
  font-size: 26px;
}

.career-report-content :deep(h2) {
  font-size: 22px;
}

.career-report-content :deep(h3) {
  font-size: 18px;
}

.career-report-content :deep(p) {
  margin: 0 0 12px;
}

.career-report-content :deep(ul),
.career-report-content :deep(ol) {
  margin: 0 0 12px;
  padding-left: 24px;
}

.career-report-content :deep(li) {
  margin: 4px 0;
}

.career-report-content :deep(code) {
  border-radius: 4px;
  background: #f5f7fa;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 0.92em;
  padding: 2px 5px;
}

.career-report-content :deep(pre) {
  margin: 12px 0;
  overflow-x: auto;
  border-radius: 8px;
  background: #f5f7fa;
  padding: 14px;
}

.career-report-content :deep(pre code) {
  display: block;
  background: transparent;
  line-height: 1.6;
  padding: 0;
}

.career-empty {
  color: #667085;
  line-height: 1.7;
}

.career-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  line-height: 1.5;
  padding: 12px;
}

.career-status span {
  flex-shrink: 0;
  border-radius: 999px;
  background: #dbeafe;
  color: #1e40af;
  font-size: 12px;
  font-weight: 800;
  padding: 3px 8px;
}

.match-score {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  border: 1px solid #dcfce7;
  border-radius: 10px;
  background: #f0fdf4;
  color: #166534;
  padding: 10px 12px;
}

.match-score span {
  color: #15803d;
  font-size: 12px;
  font-weight: 800;
}

.match-score strong {
  font-size: 20px;
}

.career-confirm-panel,
.career-confirm-result {
  margin-top: 18px;
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  background: #f9fafb;
  padding: 14px;
}

.career-confirm-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.career-confirm-title {
  color: #101828;
  font-size: 15px;
  font-weight: 800;
}

.career-confirm-desc {
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
}

.career-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.career-confirm-button {
  min-width: 96px;
  height: 36px;
  border: none;
  border-radius: 9px;
  background: #1677ff;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.career-confirm-secondary {
  background: #d48806;
}

.career-confirm-danger {
  background: #f56c6c;
}

.career-confirm-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.career-confirm-error {
  width: 100%;
  margin-top: 10px;
  color: #cf1322;
  line-height: 1.5;
}

.career-confirm-result {
  display: grid;
  gap: 8px;
  color: #303133;
  line-height: 1.5;
}

.career-confirm-result span {
  font-weight: 700;
}

@media (max-width: 900px) {

  .career-hero,
  .career-report-header,
  .career-confirm-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .career-grid,
  .career-inline-grid {
    grid-template-columns: 1fr;
  }

  .workflow-chip {
    max-width: none;
  }
}
</style>
