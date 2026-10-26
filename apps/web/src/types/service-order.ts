
export type ServiceOrderStatus =
  | 'ENTRADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDO'

export interface ServiceOrder {
  id: number
  customer: string
  device: string
  issue: string
  status: ServiceOrderStatus
  receivedAt: string
}
