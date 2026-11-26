<script setup lang="ts">
import { reactive, ref } from 'vue'
import { FbkFormGenerator } from '@fbkworks/components/form-generator'
import type { FormSchema } from '@fbkworks/components/form-generator'

/**
 * 复现：必填的数字字段预填 0，被判成「没填」。
 *
 * FormGenerator 构造 required 规则时不带 type，async-validator 对未标注类型的
 * required 默认按 string 处理 —— 数字 0 因此成了「空值」。
 *
 * 三块对照：
 *   ① number + required + 0   → 病态（红字拦住）
 *   ② number + required + 5   → 正常
 *   ③ input  + required + '0' → 正常（说明「一律补 string」不是解法）
 */
const schemaOf = (name: string, label: string, type: 'number' | 'input'): FormSchema => ({
  columns: 1,
  fields: [{ name, label, type, required: true }],
})

const zeroSchema = schemaOf('stock', '库存', 'number')
const fiveSchema = schemaOf('stock', '库存', 'number')
const emptySchema = schemaOf('stockEmpty', '库存（空）', 'number')
const textSchema = schemaOf('stockText', '库存（文本）', 'input')

const zeroForm = ref<any>()
const fiveForm = ref<any>()
const emptyForm = ref<any>()
const textForm = ref<any>()

/* 模板里 ref 会被自动解包，所以结果用 reactive 字典而不是三个 ref：
   传 ref 进去拿到的是字符串，赋值会静默失败（TypeError: Cannot create property）。 */
const results = reactive({
  zero: '尚未点「校验」',
  five: '尚未点「校验」',
  empty: '尚未点「校验」',
  text: '尚未点「校验」',
})

async function check(form: any, key: 'zero' | 'five' | 'empty' | 'text') {
  try {
    await form?.validate()
    results[key] = '校验通过 → 可以提交'
  } catch {
    results[key] = '校验不通过 → 提交被拦住（红字在输入框下方）'
  }
}
</script>

<template>
  <div class="fbk-demo-stack">
    <section data-section="bug-number-zero">
      <h4 class="fbk-demo-note"><strong>① 病态：type: 'number' + required + 预填 0</strong></h4>
      <p class="fbk-demo-note">
        你应该看到：输入框里明明是 0，点「校验」后输入框下方出现红字「库存不能为空」，
        结果行写「校验不通过」——0 被判成了没填。
      </p>
      <div style="padding-bottom: 22px">
        <FbkFormGenerator
          ref="zeroForm"
          :schema="zeroSchema"
          :default-values="{ stock: 0 }"
          mode="create"
          :show-actions="false"
        />
      </div>
      <div class="fbk-demo-actions">
        <button
          type="button"
          class="fbk-demo-btn fbk-demo-btn--primary"
          data-act="validate-zero"
          @click="check(zeroForm, 'zero')"
        >
          校验（预填 0）
        </button>
        <span class="fbk-demo-note" data-result="zero">{{ results.zero }}</span>
      </div>
    </section>

    <section data-section="ok-controls">
      <h4 class="fbk-demo-note"><strong>② 左右对照：文本字段的 "0" vs 数字字段的 5</strong></h4>
      <p class="fbk-demo-note">
        你应该看到：数字字段预填 5 在<strong>修复前同样报红</strong>——说明问题不是「0 特殊」，
        而是数字值被当成字符串校验；没预填的空值则无论修没修都必须报红（required 没有被放宽），
        文本字段的 "0" 一直正常。
      </p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--fbk-spacing-lg)">
        <div data-case="number-five">
          <p class="fbk-demo-note"><strong>数字字段预填 5</strong></p>
          <div style="padding-bottom: 22px">
            <FbkFormGenerator
              ref="fiveForm"
              :schema="fiveSchema"
              :default-values="{ stock: 5 }"
              mode="create"
              :show-actions="false"
            />
          </div>
          <div class="fbk-demo-actions">
            <button
              type="button"
              class="fbk-demo-btn fbk-demo-btn--primary"
              data-act="validate-five"
              @click="check(fiveForm, 'five')"
            >
              校验（预填 5）
            </button>
            <span class="fbk-demo-note" data-result="five">{{ results.five }}</span>
          </div>
        </div>
        <div data-case="number-empty">
          <p class="fbk-demo-note"><strong>数字字段不预填（空值）</strong></p>
          <div style="padding-bottom: 22px">
            <FbkFormGenerator
              ref="emptyForm"
              :schema="emptySchema"
              mode="create"
              :show-actions="false"
            />
          </div>
          <div class="fbk-demo-actions">
            <button
              type="button"
              class="fbk-demo-btn fbk-demo-btn--primary"
              data-act="validate-empty"
              @click="check(emptyForm, 'empty')"
            >
              校验（空值）
            </button>
            <span class="fbk-demo-note" data-result="empty">{{ results.empty }}</span>
          </div>
        </div>
        <div data-case="input-zero">
          <p class="fbk-demo-note"><strong>文本字段预填 "0"</strong></p>
          <div style="padding-bottom: 22px">
            <FbkFormGenerator
              ref="textForm"
              :schema="textSchema"
              :default-values="{ stockText: '0' }"
              mode="create"
              :show-actions="false"
            />
          </div>
          <div class="fbk-demo-actions">
            <button
              type="button"
              class="fbk-demo-btn fbk-demo-btn--primary"
              data-act="validate-text"
              @click="check(textForm, 'text')"
            >
              校验（预填 "0"）
            </button>
            <span class="fbk-demo-note" data-result="text">{{ results.text }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
