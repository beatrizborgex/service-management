export type ServiceOrderStatus =
  | 'ENTRADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDO'

export interface ServiceOrder {
  id: number
  customer: string
  phone: string
  deviceBrand: string
  deviceModel: string
  issue: string
  status: ServiceOrderStatus
  receivedAt: string
}