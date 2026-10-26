<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    value: number | string
    description: string
    icon?: string
    variant?: 'entry' | 'progress' | 'completed'
  }>(),
  {
    icon: '•',
    variant: 'entry',
  },
)
</script>

<template>
  <article class="metric-card">
    <div class="metric-heading">
      <span>{{ title }}</span>
      <span
        class="metric-icon"
        :class="`${variant}-icon`"
        aria-hidden="true"
      >
        {{ icon }}
      </span>
    </div>

    <strong class="metric-value">{{ value }}</strong>
    <span class="metric-description">{{ description }}</span>
  </article>
</template>

<style>
.metric-card {
  display: flex;
  min-height: 148px;
  flex-direction: column;
  padding: 19px;
  border: 1px solid #e8ebf1;
  border-radius: 12px;
  background: #fff;
}

.metric-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: #727c8f;
  font-size: 12px;
}

.metric-icon {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border-radius: 9px;
  font-size: 17px;
  font-weight: 700;
}

.entry-icon {
  background: #fff3e4;
  color: #bd7b28;
}

.progress-icon {
  background: #eaf0ff;
  color: #4669c1;
}

.completed-icon {
  background: #e5f6ed;
  color: #28855c;
}

.metric-value {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 720;
  letter-spacing: -1px;
}

.metric-description {
  margin-top: 5px;
  color: #969eac;
  font-size: 11px;
}

</style>

