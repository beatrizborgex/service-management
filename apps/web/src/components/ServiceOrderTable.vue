<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  ServiceOrder,
  ServiceOrderStatus,
} from '../types/service-order'

const props = defineProps<{
  orders: ServiceOrder[]
  statusLabels: Record<ServiceOrderStatus, string>
}>()

const searchTerm = ref('')

const filteredOrders = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  if (!term) {
    return props.orders
  }

  return props.orders.filter((order) =>
    [
      String(order.id),
      order.customer,
      order.device,
      order.issue,
    ].some((value) => value.toLowerCase().includes(term)),
  )
})
</script>

<template>
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
</template>

<style>
.orders-section {
  margin-top: 36px;
  overflow: hidden;
  border: 1px solid #e8ebf1;
  border-radius: 13px;
  background: #fff;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 23px;
}

.section-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.section-heading p {
  margin: 9px 0 0;
  color: #8992a3;
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

@media (max-width: 760px) {
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
