<script setup>
import { ref } from 'vue'

import axios from 'axios'

// 用户输入框内容
const question = ref('')

// 聊天消息列表
const messages = ref([])

// 是否正在加载
const loading = ref(false)

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

  try {
    // 调用 FastAPI 后端
    let requestData = {
      user_id: 'Joker3e',
      question: question.value,
    }
    const response = await axios.post('http://127.0.0.1:8000/ask', requestData)

    // 把 AI 回复加入聊天列表
    messages.value.push({
      role: 'assistant',
      content: response.data.content,
    })
  } catch (error) {
    console.error(error)

    messages.value.push({
      role: 'assistant',
      content: '请求失败，请检查后端服务',
    })
  }

  // 清空输入框
  question.value = ''

  // 关闭 loading
  loading.value = false
}
</script>

<template>
  <div class="container">
    <h1>AI RAG Chat</h1>

    <!-- 聊天区域 -->
    <div class="chat-box">
      <!-- 循环渲染消息 -->
      <div v-for="(msg, index) in messages" :key="index" class="message">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="user-message">你：{{ msg.content }}</div>

        <!-- AI 消息 -->
        <div v-else class="ai-message">AI：{{ msg.content }}</div>
      </div>
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
}

/* AI 消息 */
.ai-message {
  text-align: left;
  color: green;
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
</style>
