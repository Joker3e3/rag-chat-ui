<script setup>
import { nextTick } from 'vue'
import { ref } from 'vue'

import axios from 'axios'
import { ElMessage } from 'element-plus'

// 用户输入框内容
const question = ref('')

// 聊天消息列表
const messages = ref([])

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
    <h1>AI RAG Chat</h1>

    <!-- 聊天区域 -->
    <div ref="chatBox" class="chat-box">
      <!-- 循环渲染消息 -->
      <div v-for="(msg, index) in messages" :key="index" class="message">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="user-message">你：{{ msg.content }}</div>

        <!-- AI 消息 -->
        <div v-else class="ai-message">AI：{{ msg.content }}</div>
        <div v-if="msg.sources && msg.sources.length" class="sources">
          <div v-for="(source, i) in msg.sources" :key="i" class="source-item">
            <div>来源：{{ source.filename }}</div>
            <div>第 {{ source.page + 1 }} 页</div>
            <div class="source-content">{{ source.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文件上传区域 -->
    <div class="upload-box">
      <input type="file" @change="handleFileChange" />

      <button @click="uploadFile" :disabled="uploading">
        {{ uploading ? '上传中...' : '上传文件' }}
      </button>
    </div>
    <!-- 输入区域 -->
    <div class="input-box">
      <!-- v-model 双向绑定 -->
      <input v-model="question" placeholder="请输入问题" @keyup.enter="sendMessage" />

      <button @click="sendMessage" :disabled="loading">
        {{ loading ? '思考中...' : '发送' }}
      </button>
    </div>
  </div>
</template>

<style>
/* 页面整体 */
body {
  margin: 0;
  background: #f5f5f5;
  font-family: Arial;
}

/* 主容器 */
.container {
  width: 800px;
  margin: 30px auto;
}

/* 标题 */
h1 {
  text-align: center;
}

/* 聊天框 */
.chat-box {
  height: 600px;
  background: white;
  border-radius: 10px;
  padding: 20px;
  overflow-y: auto;
}

/* 单条消息 */
.message {
  margin-bottom: 20px;
}

/* 用户消息 */
.user-message {
  text-align: right;
  color: blue;
  white-space: pre-wrap;
}

/* AI 消息 */
.ai-message {
  text-align: left;
  color: green;
  white-space: pre-wrap;
}

/* 上传区域 */
.upload-box {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 10px;
}

/* 输入区域 */
.input-box {
  display: flex;
  margin-top: 20px;
}

/* 输入框 */
input {
  flex: 1;
  height: 40px;
  padding: 0 10px;
  font-size: 16px;
}

/* 按钮 */
button {
  width: 100px;
  margin-left: 10px;
}
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
}
</style>
