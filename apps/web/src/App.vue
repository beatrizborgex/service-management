<script setup lang="ts">
import { computed, ref } from 'vue'
import StatCard from './components/StatCard.vue'

type ServiceOrderStatus = 'ENTRADA' | 'EM_ANDAMENTO' | 'CONCLUIDO'

interface ServiceOrder {
  id: number
  customer: string
  device: string
  issue: string
  status: ServiceOrderStatus
  receivedAt: string
}

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

const searchTerm = ref('')

const filteredOrders = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  if (!term) {
    return serviceOrders.value
  }

  return serviceOrders.value.filter((order) =>
    [
      String(order.id),
      order.customer,
      order.device,
      order.issue,
    ].some((value) => value.toLowerCase().includes(term)),
  )
})

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

      <section id="orders" class="orders-section">
        <div class="section-heading">
          <div>
            <h2>Ordens de serviço</h2>
            <p>Acompanhe os atendimentos recentes.</p>
          </div>

          <label class="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              v-model="searchTerm"
              type="search"
              placeholder="Buscar OS, cliente ou aparelho"
              aria-label="Buscar ordens de serviço"
            />
          </label>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente e aparelho</th>
                <th>Problema relatado</th>
                <th>Status</th>
                <th>Recebido em</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="order in filteredOrders" :key="order.id">
                <td class="order-number">#{{ order.id }}</td>

                <td>
                  <div class="customer-cell">
                    <strong>{{ order.customer }}</strong>
                    <span>{{ order.device }}</span>
                  </div>
                </td>

                <td>{{ order.issue }}</td>

                <td>
                  <span
                    class="status-badge"
                    :class="`status-${order.status.toLowerCase()}`"
                  >
                    {{ statusLabels[order.status] }}
                  </span>
                </td>

                <td class="date-cell">{{ order.receivedAt }}</td>
              </tr>

              <tr v-if="filteredOrders.length === 0">
                <td colspan="5" class="empty-state">
                  Nenhuma ordem encontrada para essa busca.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="table-footer">
          <span>
            {{ filteredOrders.length }}
            {{ filteredOrders.length === 1 ? 'ordem encontrada' : 'ordens encontradas' }}
          </span>

          <span>Exibindo dados fictícios para desenvolvimento</span>
        </footer>
      </section>
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

.topbar,
.section-heading,

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

.page-description,
.section-heading p {
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

.metric-heading {
  color: #727c8f;
  font-size: 12px;
}

.orders-section {
  margin-top: 36px;
  overflow: hidden;
  border: 1px solid #e8ebf1;
  border-radius: 13px;
  background: #fff;
}

.section-heading {
  padding: 24px 23px;
}

.section-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.section-heading p {
  font-size: 12px;
}

.search-field {
  display: flex;
  width: min(290px, 45%);
  min-height: 39px;
  align-items: center;
  gap: 9px;
  padding: 0 11px;
  border: 1px solid #e5e8ef;
  border-radius: 8px;
  color: #8c95a5;
}

.search-field > span {
  font-size: 22px;
}

.search-field input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #263044;
  font-size: 11px;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  white-space: nowrap;
}

thead {
  background: #fafbfc;
}

th {
  padding: 13px 17px;
  color: #858ea0;
  font-size: 10px;
  font-weight: 650;
}

td {
  padding: 16px 17px;
  border-top: 1px solid #f0f2f6;
  color: #697386;
  font-size: 11px;
}

.order-number {
  color: #354a7b;
  font-weight: 700;
}

.customer-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.customer-cell strong {
  color: #303b4e;
  font-size: 11px;
  font-weight: 650;
}

.customer-cell span,
.date-cell {
  color: #929aaa;
  font-size: 10px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 9px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 650;
}

.status-entrada {
  background: #fff3e4;
  color: #ad6d1e;
}

.status-em_andamento {
  background: #eaf0ff;
  color: #4161b1;
}

.status-concluido {
  background: #e5f6ed;
  color: #287a55;
}

.empty-state {
  padding: 36px 16px;
  color: #8992a3;
  text-align: center;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 22px;
  border-top: 1px solid #f0f2f6;
  color: #929aaa;
  font-size: 10px;
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

  .metric-card {
    padding: 14px;
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

  .metric-card {
    min-height: 125px;
  }

  .section-heading {
    align-items: stretch;
    flex-direction: column;
    padding: 19px 16px;
  }

  .search-field {
    width: 100%;
  }

  .table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>