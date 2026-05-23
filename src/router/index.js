import { createRouter, createWebHistory } from 'vue-router'
import RagChatView from '../views/RagChatView.vue'
import CareerAgent from '../views/CareerAgent.vue'

const routes = [
  {
    path: '/',
    redirect: '/rag-chat',
  },
  {
    path: '/rag-chat',
    name: 'rag-chat',
    component: RagChatView,
  },
  {
    path: '/career-agent',
    name: 'career-agent',
    component: CareerAgent,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
