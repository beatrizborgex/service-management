
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  submit: [data: {
    customer: string
    phone: string
    deviceBrand: string
    deviceModel: string
    issue: string
  }]
}>()

const customer = ref('')
const phone = ref('')
const deviceBrand = ref('')
const deviceModel = ref('')
const issue = ref('')
const errorMessage = ref('')

function handleSubmit() {
  const customerName = customer.value.trim()
  const customerPhone = phone.value.trim()
  const deviceBrandName = deviceBrand.value.trim()
  const deviceModelName = deviceModel.value.trim()
  const reportedIssue = issue.value.trim()

  if (!customerName || !customerPhone || !deviceBrandName || !deviceModelName || !reportedIssue) {
    errorMessage.value = 'Preencha todos os campos antes de continuar.'
    return
  }

  const phoneDigits = customerPhone.replace(/\D/g, '')
  const localPhone =
    phoneDigits.startsWith('55') && phoneDigits.length >= 12
      ? phoneDigits.slice(2)
      : phoneDigits

  if (!/^\d{10,11}$/.test(localPhone)) {
    errorMessage.value =
      'Informe um telefone válido com DDD, como (67) 99999-9999.'
    return
  }

  const namePattern = /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u

  if (!namePattern.test(customerName)) {
    errorMessage.value =
      'Informe um nome válido, usando letras e separadores adequados.'
    return
  }

    if (deviceBrandName.length < 2 || !/\p{L}/u.test(deviceBrandName)) {
    errorMessage.value = 'Informe uma marca de aparelho válida.'
    return
    }

    if (deviceModelName.length < 2 || !/\p{L}/u.test(deviceModelName)) {
    errorMessage.value = 'Informe um modelo de aparelho válido.'
    return
    }

  if (reportedIssue.length < 5 || !/\p{L}/u.test(reportedIssue)) {
    errorMessage.value =
      'Descreva o problema com pelo menos 5 caracteres e uma letra.'
    return
  }

  errorMessage.value = ''

  emit('submit', {
    customer: customerName,
    phone: customerPhone,
    deviceBrand: deviceBrandName,
    deviceModel: deviceModelName,
    issue: reportedIssue,
  })

  customer.value = ''
  phone.value = ''
  deviceBrand.value = ''
  deviceModel.value = ''
  issue.value = ''
}
</script>

<template>
  <form class="order-form" @submit.prevent="handleSubmit">
    <div class="form-field">
      <label for="customer">Nome do cliente</label>
      <input
        id="customer"
        v-model="customer"
        type="text"
        placeholder="Nome do cliente"
        autocomplete="name"
        required
        @input="errorMessage = ''"
      />
    </div>

    <div class="form-field">
      <label for="phone">Telefone do cliente</label>
      <input
        id="phone"
        v-model="phone"
        type="tel"
        placeholder="(67) 99999-9999"
        autocomplete="tel"
        required
        @input="errorMessage = ''"
      />
    </div>

    <div class="form-field">
    <label for="deviceBrand">Marca do aparelho</label>
    <input
        id="deviceBrand"
        v-model="deviceBrand"
        type="text"
        placeholder="Ex.: Samsung, Apple, Motorola"
        required
        @input="errorMessage = ''"
    />
    </div>

    <div class="form-field">
    <label for="deviceModel">Modelo do aparelho</label>
    <input
        id="deviceModel"
        v-model="deviceModel"
        type="text"
        placeholder="Ex.: Galaxy A54, iPhone 13"
        required
        @input="errorMessage = ''"
    />
    </div>

    <div class="form-field">
      <label for="issue">Problema relatado</label>
      <textarea
        id="issue"
        v-model="issue"
        placeholder="Descreva o problema informado pelo cliente"
        rows="3"
        required
        @input="errorMessage = ''"
      />
    </div>

    <p
      v-if="errorMessage"
      class="form-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <div class="form-actions">
      <button type="submit" class="submit-button">
        Cadastrar ordem
      </button>
    </div>
  </form>
</template>

<style>
.order-form {
  display: grid;
  gap: 18px;
}

.form-field {
  display: grid;
  gap: 7px;
}

.form-field label {
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.form-field input,
.form-field textarea {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #dce1eb;
  border-radius: 8px;
  background: #fff;
  color: #202a3b;
  font-size: 13px;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: #536da8;
  outline: 2px solid #e4eafb;
}

.form-field textarea {
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.submit-button {
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: #273b6d;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.submit-button:hover {
  background: #1e2e57;
}

.form-error {
  margin: 0;
  color: #b42318;
  font-size: 13px;
}
</style>
