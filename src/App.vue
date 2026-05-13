<script setup>
import { nextTick } from 'vue'
import { ref } from 'vue'
import { onMounted } from 'vue'

import axios from 'axios'
import {ElMessage, ElMessageBox } from 'element-plus'

onMounted(() => { loadDocuments() })

// 用户输入框内容
const question = ref('')

// 聊天消息列表
const messages = ref([])

// 知识库文件
const documents = ref([])

// 是否正在加载
const loading = ref(false)
const chatBox = ref(null)

// 当前选中的文件
const selectedFile = ref(null)

// 上传状态
const uploading = ref(false)

// 滚动函数
const scrollToBottom = async () => {
  await nextTick()

  if (chatBox.value) {
    chatBox.value.scrollTop = chatBox.value.scrollHeight
  }
}

const uploadFile = async () => {
  if (!selectedFile.value) {
    alert('请选择文件')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('user_id', 'Joker3e')
    formData.append('file', selectedFile.value)
    const response = await axios.post('http://127.0.0.1:8000/upload', formData)
    ElMessage.success(response.data.message)
    selectedFile.value = null
  } catch (error) {
    console.error(error)
    const errMsg = error.response?.data?.detail || '上传失败'
    ElMessage.error(errMsg)
  }
  uploading.value = false
  await loadDocuments()
}

// 获取文件列表
const loadDocuments = async () => {
  try {
    const response = await axios.get('http://127.0.0.1:8000/documents', { params: { user_id: 'Joker3e' } })
    documents.value = response.data
  } catch (error) {
    console.error(error)
  }
}

// 删除文件
const deleteDocument = async (fileHash) => {
  ElMessageBox.confirm('确定要删除这个文件吗？', '提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      await axios.delete('http://127.0.0.1:8000/delete_document', {
        params: { user_id: 'Joker3e', file_hash: fileHash }
      })
      await loadDocuments()
      ElMessage.success('删除成功')
    } catch (error) {
      console.error(error)
      ElMessage.error('删除失败')
    }
  }).catch(() => {
    // 用户取消删除
  })
}

// 发送消息函数
const sendMessage = async () => {
  // 防止空输入
  if (!question.value.trim()) {
    return
  }

  // 先把用户消息加入聊天列表
  messages.value.push({
    role: 'user',
    content: question.value,
  })

  let requestData = {
    user_id: 'Joker3e',
    question: question.value,
  }
  // 清空输入框
  question.value = ''
  loading.value = true
  try {
    // 调用 FastAPI 后端
    const aiMessage = {
      role: 'assistant',
      content: '',
    }
    messages.value.push(aiMessage)

    const response = await fetch('http://127.0.0.1:8000/chat_stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })
    // 获取流读取器
    const reader = response.body.getReader()

    // 文本解码器
    const decoder = new TextDecoder('utf-8')

    // 持续读取
    while (true) {
      // 读取流数据
      const { done, value } = await reader.read()

      // done=true 表示结束
      if (done) {
        break
      }

      // 解码二进制数据
      const chunk = decoder.decode(value)

      // 追加到 AI 消息
      const lastIndex = messages.value.length - 1
      const last = messages.value[lastIndex]
      messages.value.splice(lastIndex, 1, {
        ...last,
        content: last.content + chunk,
      })
      await scrollToBottom()
    }
    const sourcesAndHistory = await axios.post('http://127.0.0.1:8000/sources_history', requestData)
    const lastIndex = messages.value.length - 1
    const last = messages.value[lastIndex]
    messages.value.splice(lastIndex, 1, {
      ...last,
      sources: sourcesAndHistory.data.sources,
    })
    // const response = await axios.post('http://127.0.0.1:8000/ask', requestData)

    // 把 AI 回复加入聊天列表
    // messages.value.push({
    //   role: 'assistant',
    //   content: response.data.content,
    // })
  } catch (error) {
    console.error(error)

    messages.value.push({
      role: 'assistant',
      content: '请求失败，请检查后端服务',
    })
  }

  // 关闭 loading
  loading.value = false
}

const handleFileChange = (event) => {
  selectedFile.value = event.target.files[0]
}
</script>

<template>
  <div class="container">
    <div class="main-layout">
      <!-- 左侧知识库 -->
      <div class="document-panel">
        <div class="document-header">
          <h2>知识库</h2>
        </div>

        <!-- 上传区域 -->
        <div class="upload-box">
          <input type="file" @change="handleFileChange" />

          <button @click="uploadFile" :disabled="uploading">
            {{ uploading ? '上传中...' : '上传文件' }}
          </button>
        </div>

        <!-- 文件列表 -->
        <div class="document-list">
          <div v-for="doc in documents" :key="doc.file_hash" class="document-item">
            <div class="document-name">{{ doc.filename }}</div>

            <button class="delete-btn" @click="deleteDocument(doc.file_hash)">
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 聊天区域 -->
      <div class="chat-wrapper">
        <!-- 聊天框 -->
        <div ref="chatBox" class="chat-box">
          <!-- 循环渲染消息 -->
          <div v-for="(msg, index) in messages" :key="index" class="message">
            <!-- 用户消息 -->
            <div v-if="msg.role === 'user'" class="user-row">
              <div class="user-message">{{ msg.content }}</div>
            </div>

            <!-- AI 消息 -->
            <div v-else class="ai-row">
              <div class="ai-message">{{ msg.content }}</div>
            </div>

            <!-- 来源 -->
            <div v-if="msg.sources && msg.sources.length" class="sources">
              <div v-for="(source, i) in msg.sources" :key="i" class="source-item">
                <div>来源：{{ source.filename }}</div>
                <div>第 {{ source.page + 1 }} 页</div>
                <div class="source-content">{{ source.content }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-box">
          <input v-model="question" placeholder="请输入问题" @keyup.enter="sendMessage" />

          <button @click="sendMessage" :disabled="loading">
            {{ loading ? '思考中...' : '发送' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 页面整体 */
body {
  margin: 0;
  background: #f3f6fb;
  font-family: Arial;
}

* {
  box-sizing: border-box;
}

.container {
  width: 1400px;
  margin: 20px auto;
}

.main-layout {
  display: flex;
  gap: 20px;
  height: 90vh;
}

/* 左侧知识库 */
.document-panel {
  width: 300px;
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.document-header {
  margin-bottom: 20px;
}

.document-header h2 {
  margin: 0;
}

/* 上传区域 */
.upload-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.upload-box input {
  width: 100%;
}

/* 文件列表 */
.document-list {
  flex: 1;
  overflow-y: auto;
}

/* 文件项 */
.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7f8fa;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
}

.document-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

/* 删除按钮 */
.delete-btn {
  width: 60px;
  height: 32px;
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* 聊天区域 */
.chat-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 聊天框 */
.chat-box {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 20px;
  overflow-y: auto;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

/* 单条消息 */
.message {
  margin-bottom: 20px;
}

/* 用户消息 */
.user-row {
  display: flex;
  justify-content: flex-end;
}

.user-message {
  max-width: 70%;
  background: #1677ff;
  color: white;
  padding: 14px 18px;
  border-radius: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* AI 消息 */
.ai-row {
  display: flex;
  justify-content: flex-start;
}

.ai-message {
  max-width: 70%;
  background: #f5f5f5;
  color: #333;
  padding: 14px 18px;
  border-radius: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* 来源 */
.sources {
  margin-top: 10px;
}

.source-item {
  background: #f3f3f3;
  padding: 10px;
  border-radius: 8px;
  margin-top: 10px;
  font-size: 14px;
}

.source-content {
  margin-top: 5px;
  color: #666;
  line-height: 1.5;
}

/* 输入区域 */
.input-box {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

input {
  flex: 1;
  height: 40px;
  padding: 0 10px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 10px;
}

/* 按钮 */
button {
  width: 100px;
  border: none;
  border-radius: 10px;
  background: #1677ff;
  color: white;
  cursor: pointer;
}
</style>
