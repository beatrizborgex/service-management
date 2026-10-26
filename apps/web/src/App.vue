
<script setup lang="ts">
import { computed, ref } from 'vue'
import StatCard from './components/StatCard.vue'
import ServiceOrderTable from './components/ServiceOrderTable.vue'
import type {
  ServiceOrder,
  ServiceOrderStatus,
} from './types/service-order'

const companyName = 'Noturna Celulares'

const serviceOrders = ref<ServiceOrder[]>([
  {
    id: 1025,
    customer: 'Mariana Oliveira',
    device: 'Samsung Galaxy A54',
    issue: 'Tela danificada',
    status: 'ENTRADA',
    receivedAt: '09:15',
  },
  {
    id: 1024,
    customer: 'Carlos Mendes',
    device: 'iPhone 13',
    issue: 'Bateria com baixa duração',
    status: 'EM_ANDAMENTO',
    receivedAt: 'Ontem',
  },
  {
    id: 1023,
    customer: 'Juliana Santos',
    device: 'Motorola Edge 40',
    issue: 'Conector de carregamento',
    status: 'CONCLUIDO',
    receivedAt: 'Ontem',
  },
  {
    id: 1022,
    customer: 'Rafael Costa',
    device: 'Xiaomi Redmi Note 12',
    issue: 'Aparelho não liga',
    status: 'EM_ANDAMENTO',
    receivedAt: '23 out.',
  },
])

const statusLabels: Record<ServiceOrderStatus, string> = {
  ENTRADA: 'Entrada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluída',
}

const statusCounts = computed(() => ({
  ENTRADA: serviceOrders.value.filter(
    (order) => order.status === 'ENTRADA',
  ).length,
  EM_ANDAMENTO: serviceOrders.value.filter(
    (order) => order.status === 'EM_ANDAMENTO',
  ).length,
  CONCLUIDO: serviceOrders.value.filter(
    (order) => order.status === 'CONCLUIDO',
  ).length,
}))

function createServiceOrder() {
  window.alert('A abertura de OS será implementada na próxima etapa.')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="Página inicial">
        <span class="brand-icon">N</span>

        <span class="brand-text">
          <strong>Noturna Celulares</strong>
          <small>GESTÃO DE SERVIÇOS</small>
        </span>
      </a>

      <div class="sidebar-section">
        <span class="sidebar-label">MENU PRINCIPAL</span>

        <nav class="navigation" aria-label="Menu principal">
          <a class="navigation-link active" href="#dashboard">
            <span aria-hidden="true">▦</span>
            Visão geral
          </a>

          <a class="navigation-link" href="#orders">
            <span aria-hidden="true">▤</span>
            Ordens de serviço
          </a>

          <a class="navigation-link" href="#customers">
            <span aria-hidden="true">♙</span>
            Clientes
          </a>
        </nav>
      </div>

      <div class="sidebar-footer">
        <span class="avatar">NB</span>

        <span class="user-details">
          <strong>Beatriz Borges</strong>
          <small>Administradora</small>
        </span>

        <span class="user-menu" aria-hidden="true">···</span>
      </div>
    </aside>

    <main id="dashboard" class="main-content">
      <header class="topbar">
        <div>
          <p class="breadcrumb">Painel / Visão geral</p>
          <h1>Bom dia, Beatriz 👋</h1>
          <p class="page-description">
            Acompanhe os atendimentos da sua assistência.
          </p>
        </div>

        <button class="primary-button" @click="createServiceOrder">
          <span aria-hidden="true">+</span>
          Nova ordem de serviço
        </button>
      </header>

      <section class="company-banner" aria-label="Empresa selecionada">
        <div class="company-symbol">N</div>

        <div>
          <span class="company-caption">EMPRESA ATUAL</span>
          <h2>{{ companyName }}</h2>
          <p>Assistência técnica de celulares</p>
        </div>

        <span class="environment-label">DADOS DE DEMONSTRAÇÃO</span>
      </section>

      <section class="metrics-section" aria-label="Resumo das ordens">
        <StatCard
          title="Novas entradas"
          :value="statusCounts.ENTRADA"
          description="Aguardando avaliação"
          icon="↘"
          variant="entry"
        />

        <StatCard
          title="Em andamento"
          :value="statusCounts.EM_ANDAMENTO"
          description="Em reparo ou avaliação"
          icon="◷"
          variant="progress"
        />

        <StatCard
          title="Concluídas"
          :value="statusCounts.CONCLUIDO"
          description="Serviços finalizados"
          icon="✓"
          variant="completed"
        />
      </section>

      <ServiceOrderTable
        id="orders"
        :orders="serviceOrders"
        :status-labels="statusLabels"
      />
    </main>
  </div>
</template>

<style>
:root {
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #202a3b;
  background: #f6f7fb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-optical-sizing: auto;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 360px;
  min-height: 100vh;
  margin: 0;
}

button,
input {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

button {
  cursor: pointer;
}

a {
  color: inherit;
  text-decoration: none;
}

.app-shell {
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 2;
  display: flex;
  width: 248px;
  flex-direction: column;
  padding: 28px 18px 18px;
  background: #fff;
  border-right: 1px solid #e8ebf1;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 8px;
}

.brand-icon,
.company-symbol {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  background: #202e52;
  color: #fff;
  font-weight: 800;
}

.brand-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  font-size: 23px;
}

.brand-text,
.user-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-text strong {
  font-size: 17px;
  letter-spacing: -0.5px;
}

.brand-text small {
  color: #8790a2;
  font-size: 9px;
  letter-spacing: 1px;
}

.sidebar-section {
  margin-top: 48px;
}

.sidebar-label,
.company-caption {
  color: #9098a9;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}

.sidebar-label {
  padding-left: 12px;
}

.navigation {
  display: grid;
  gap: 7px;
  margin-top: 15px;
}

.navigation-link {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 12px;
  padding: 0 13px;
  border-radius: 9px;
  color: #6c7689;
  font-size: 13px;
  font-weight: 500;
}

.navigation-link > span {
  width: 20px;
  font-size: 18px;
  text-align: center;
}

.navigation-link.active {
  background: #eef1f8;
  color: #263c70;
  font-weight: 650;
}

.sidebar-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 18px 4px 0;
  border-top: 1px solid #edf0f5;
}

.avatar {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: #e9eaf8;
  color: #434a8a;
  font-size: 11px;
  font-weight: 700;
}

.user-details {
  min-width: 0;
}

.user-details strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-details small {
  color: #8790a2;
  font-size: 10px;
}

.user-menu {
  margin-left: auto;
  color: #7b8495;
  font-size: 20px;
}

.main-content {
  max-width: 1600px;
  min-height: 100vh;
  margin-left: 248px;
  padding: 42px 44px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.breadcrumb {
  margin: 0 0 13px;
  color: #9098a9;
  font-size: 12px;
}

.topbar h1 {
  margin: 0;
  font-size: clamp(23px, 2.5vw, 29px);
  font-weight: 720;
  letter-spacing: -1px;
}

.page-description {
  margin: 9px 0 0;
  color: #8992a3;
  font-size: 13px;
}

.primary-button {
  display: inline-flex;
  min-height: 43px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 17px;
  border: 0;
  border-radius: 9px;
  background: #273b6d;
  color: white;
  font-size: 12px;
  font-weight: 650;
}

.primary-button:hover {
  background: #1e2e57;
}

.primary-button > span {
  font-size: 20px;
  font-weight: 400;
}

.company-banner {
  display: flex;
  min-height: 108px;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
  padding: 20px 24px;
  border: 1px solid #e7eaf1;
  border-radius: 13px;
  background: #fff;
}

.company-symbol {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  font-size: 25px;
}

.company-banner h2 {
  margin: 5px 0 0;
  font-size: 16px;
  font-weight: 700;
}

.company-banner p {
  margin: 4px 0 0;
  color: #8992a3;
  font-size: 12px;
}

.environment-label {
  margin-left: auto;
  padding: 7px 9px;
  border-radius: 6px;
  background: #f1f3f8;
  color: #69758d;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.metrics-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 25px;
}

@media (max-width: 1050px) {
  .sidebar {
    width: 210px;
  }

  .main-content {
    margin-left: 210px;
    padding: 32px 24px;
  }

  .metrics-section {
    gap: 10px;
  }
}

@media (max-width: 760px) {
  .sidebar {
    position: static;
    width: 100%;
    padding: 15px 18px;
    border-right: 0;
    border-bottom: 1px solid #e8ebf1;
  }

  .sidebar-section {
    margin-top: 20px;
  }

  .navigation {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .navigation-link {
    justify-content: center;
    gap: 6px;
    padding: 8px 5px;
    font-size: 10px;
  }

  .navigation-link > span {
    display: none;
  }

  .sidebar-footer {
    display: none;
  }

  .main-content {
    margin-left: 0;
    padding: 26px 16px;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .company-banner {
    flex-wrap: wrap;
    padding: 16px;
  }

  .environment-label {
    margin-left: 0;
  }

  .metrics-section {
    grid-template-columns: 1fr;
  }
}
</style>
