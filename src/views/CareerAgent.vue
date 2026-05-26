<script setup>
import { computed, ref } from 'vue'
import axios from 'axios'
import MarkdownIt from 'markdown-it'

const CAREER_AGENT_URL = 'http://127.0.0.1:8010/career_agent/analyze'
const CAREER_CONFIRM_URL = 'http://127.0.0.1:8010/career_agent/confirm'
const md = new MarkdownIt()

const sessionId = ref('user_001')
const userId = ref('Joker3e')
const jobDescription = ref('')
const resumeText = ref('')
const report = ref('')
const loading = ref(false)
const analyzeResponded = ref(false)
const error = ref('')
const workflowId = ref('')
const confirmationId = ref('')
const workflowStatus = ref('')
const confirming = ref(false)
const confirmationStatus = ref('')
const confirmationMessage = ref('')
const confirmationWorkflowStatus = ref('')
const confirmationError = ref('')

const shouldShowConfirmation = computed(() => {
  return workflowStatus.value === 'waiting_human_confirmation' && workflowId.value && confirmationId.value
})

const renderedReport = computed(() => {
  return md.render(report.value || '')
})

const resetConfirmation = () => {
  workflowId.value = ''
  confirmationId.value = ''
  workflowStatus.value = ''
  confirming.value = false
  confirmationStatus.value = ''
  confirmationMessage.value = ''
  confirmationWorkflowStatus.value = ''
  confirmationError.value = ''
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
    loading.value = false

    const data = response.data || {}
    report.value = data.report || ''
    workflowId.value = data.workflow_id || ''
    confirmationId.value = data.confirmation_id || ''
    workflowStatus.value = data.workflow_status || ''
  } catch (err) {
    console.error(err)
    error.value = err.response?.data?.detail || err.message || '分析失败，请检查后端服务'
  } finally {
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
  } catch (err) {
    console.error(err)
    confirmationError.value = err.response?.data?.detail || err.message || '确认请求失败，请检查后端服务'
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <div class="career-page">
    <div class="career-form">
      <div class="career-field">
        <label for="session-id">session_id</label>
        <input id="session-id" v-model="sessionId" type="text" />
      </div>

      <div class="career-field career-user-field">
        <label for="user-id">user_id</label>
        <input id="user-id" v-model="userId" type="text" />
      </div>

      <div class="career-grid">
        <div class="career-field">
          <label for="job-description">岗位 JD</label>
          <textarea
            id="job-description"
            v-model="jobDescription"
            placeholder="请输入岗位 JD 文本"
          ></textarea>
        </div>

        <div class="career-field">
          <label for="resume-text">简历文本</label>
          <textarea
            id="resume-text"
            v-model="resumeText"
            placeholder="请输入简历文本"
          ></textarea>
        </div>
      </div>

      <div class="career-actions">
        <button class="career-submit" :disabled="loading" @click="analyzeCareer">
          {{ loading ? '分析中...' : '开始分析' }}
        </button>
      </div>

      <div v-if="error" class="career-error">{{ error }}</div>
    </div>

    <div class="career-report">
      <div class="career-report-title">分析报告</div>
      <div v-if="loading && !analyzeResponded && !report" class="career-empty">正在生成报告...</div>
      <div v-else-if="report" class="career-report-content" v-html="renderedReport"></div>
      <div v-if="shouldShowConfirmation" class="career-confirm-panel">
        <div class="career-confirm-title">人工确认</div>
        <div class="career-confirm-actions">
          <button
            class="career-confirm-button"
            :disabled="confirming"
            @click="confirmCareer('approve')"
          >
            {{ confirming ? '提交中...' : '确认使用' }}
          </button>
          <button
            class="career-confirm-button career-confirm-secondary"
            :disabled="confirming"
            @click="confirmCareer('revise')"
          >
            需要修改
          </button>
          <button
            class="career-confirm-button career-confirm-danger"
            :disabled="confirming"
            @click="confirmCareer('reject')"
          >
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
      <div v-if="!loading && !report" class="career-empty">报告将在分析完成后显示在这里</div>
    </div>
  </div>
</template>

<style scoped>
.career-page {
  min-height: calc(90vh - 68px);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.career-form,
.career-report {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.career-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.career-user-field {
  margin-top: 0;
}

.career-form > .career-field:first-child,
.career-form > .career-user-field {
  float: left;
  width: calc(50% - 10px);
}

.career-form > .career-user-field {
  float: right;
  margin-left: 20px;
}

.career-form > .career-user-field + .career-grid {
  clear: both;
}

.career-field label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
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
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.career-field input {
  height: 40px;
  padding: 0 10px;
}

.career-field textarea {
  min-height: 240px;
  padding: 10px;
  resize: vertical;
  font-family: Arial;
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
  width: 120px;
  height: 40px;
}

.career-submit:disabled {
  background: #a0cfff;
  cursor: not-allowed;
}

.career-error {
  margin-top: 14px;
  padding: 12px;
  border-radius: 10px;
  background: #fff1f0;
  color: #cf1322;
  line-height: 1.5;
}

.career-report {
  flex: 1;
  min-height: 220px;
}

.career-report-title {
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.career-report-content {
  line-height: 1.7;
  color: #303133;
}

.career-report-content :deep(h1),
.career-report-content :deep(h2),
.career-report-content :deep(h3),
.career-report-content :deep(h4),
.career-report-content :deep(h5),
.career-report-content :deep(h6) {
  margin: 18px 0 10px;
  line-height: 1.35;
  color: #1f2d3d;
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
  padding: 2px 5px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 0.92em;
}

.career-report-content :deep(pre) {
  margin: 12px 0;
  border-radius: 8px;
  background: #f5f7fa;
  padding: 14px;
  overflow-x: auto;
}

.career-report-content :deep(pre code) {
  display: block;
  background: transparent;
  padding: 0;
  line-height: 1.6;
}

.career-empty {
  color: #909399;
  line-height: 1.7;
}

.career-confirm-panel,
.career-confirm-result {
  margin-top: 18px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #f9fafc;
  padding: 14px;
}

.career-confirm-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 700;
  color: #303133;
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
  border-radius: 8px;
  background: #1677ff;
  color: #fff;
  cursor: pointer;
}

.career-confirm-secondary {
  background: #e6a23c;
}

.career-confirm-danger {
  background: #f56c6c;
}

.career-confirm-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.career-confirm-error {
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
  .career-grid {
    grid-template-columns: 1fr;
  }
}
</style>
