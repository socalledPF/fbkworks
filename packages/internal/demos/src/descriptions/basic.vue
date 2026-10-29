<script setup lang="ts">
import { FbkDescriptions } from '@fbkworks/components/descriptions'

/**
 * 分组详情：基本信息 / 联系方式 / 扩展属性。
 * 第三个分组可折叠，用来演示 collapsible + defaultCollapsed。
 */
const data = {
  name: '张三',
  employeeNo: 'E2026001',
  department: '研发中心',
  title: '高级工程师',
  phone: '138-0000-0000',
  email: 'zhangsan@example.com',
  joinedAt: '2023-04-12',
  emergencyContact: '李四 139-0000-0000',
}

const items = [
  { key: 'name', label: '姓名', groups: ['basic'] },
  { key: 'employeeNo', label: '工号', groups: ['basic'] },
  { key: 'department', label: '部门', groups: ['basic'] },
  { key: 'title', label: '职位', groups: ['basic'] },
  { key: 'phone', label: '手机', groups: ['contact'] },
  { key: 'email', label: '邮箱', groups: ['contact'] },
  { key: 'joinedAt', label: '入职日期', groups: ['extended'] },
  { key: 'emergencyContact', label: '紧急联系人', groups: ['extended'] },
]

const groups = [
  { key: 'basic', title: '基本信息' },
  { key: 'contact', title: '联系方式' },
  { key: 'extended', title: '扩展信息', collapsible: true, defaultCollapsed: false },
]
</script>

<template>
  <FbkDescriptions :data="data" :items="items" :groups="groups" :column="2" bordered />
</template>
