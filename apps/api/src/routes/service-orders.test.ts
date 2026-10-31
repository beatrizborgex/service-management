import { afterEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    serviceOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('../lib/auth', () => ({
  authenticate: vi.fn(),
  requireCompanyAccess: vi.fn(),
}))

import prisma from '../lib/prisma'
import {
  authenticate,
  requireCompanyAccess,
} from '../lib/auth'
import { serviceOrderRoutes } from './service-orders'

const ownerUser = {
  id: 'user-owner',
  name: 'Proprietário Teste',
  email: 'owner@example.com',
  role: 'OWNER' as const,
  companyId: 'empresa-owner',
  company: {
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
  },
}

const employeeUser = {
  id: 'user-employee',
  name: 'Funcionário Teste',
  email: 'employee@example.com',
  role: 'EMPLOYEE' as const,
  companyId: 'empresa-owner',
  company: {
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
  },
}

const adminUser = {
  id: 'user-admin',
  name: 'Administrador',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  companyId: null,
  company: null,
}

const validPayload = {
  clientId: 'client-1',
  deviceBrand: 'Apple',
  deviceModel: 'iPhone 13',
  deviceColor: 'Preto',
  accessories: ['Capinha', 'Carregador'],
  reportedProblem: 'Aparelho não está carregando.',
  expectedDeliveryAt: '2026-11-05T18:00:00.000Z',
}

const client = {
  id: 'client-1',
  name: 'Maria da Silva',
  phone: '67999999999',
}

const createdServiceOrder = {
  id: 'service-order-1',
  companyId: ownerUser.companyId,
  number: 1,
  clientId: client.id,
  clientName: client.name,
  clientPhone: client.phone,
  deviceBrand: validPayload.deviceBrand,
  deviceModel: validPayload.deviceModel,
  deviceColor: validPayload.deviceColor,
  accessories: validPayload.accessories,
  reportedProblem: validPayload.reportedProblem,
  status: 'ENTRADA',
  expectedDeliveryAt: new Date(validPayload.expectedDeliveryAt),
  createdByUserId: ownerUser.id,
  createdAt: new Date('2026-10-31T10:00:00.000Z'),
  updatedAt: new Date('2026-10-31T10:00:00.000Z'),
  statusHistory: [
    {
      id: 'history-1',
      fromStatus: null,
      toStatus: 'ENTRADA',
      changedByUserId: ownerUser.id,
      createdAt: new Date('2026-10-31T10:00:00.000Z'),
    },
  ],
}

const listedServiceOrder = {
  id: createdServiceOrder.id,
  number: createdServiceOrder.number,
  clientId: createdServiceOrder.clientId,
  clientName: createdServiceOrder.clientName,
  clientPhone: createdServiceOrder.clientPhone,
  deviceBrand: createdServiceOrder.deviceBrand,
  deviceModel: createdServiceOrder.deviceModel,
  deviceColor: createdServiceOrder.deviceColor,
  accessories: createdServiceOrder.accessories,
  reportedProblem: createdServiceOrder.reportedProblem,
  status: createdServiceOrder.status,
  expectedDeliveryAt: createdServiceOrder.expectedDeliveryAt,
  completedAt: null,
  canceledAt: null,
  cancellationReason: null,
  warrantyDays: null,
  createdAt: createdServiceOrder.createdAt,
  updatedAt: createdServiceOrder.updatedAt,
}

const txMock = {
  client: {
    findFirst: vi.fn(),
  },
  company: {
    update: vi.fn(),
  },
  serviceOrder: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  serviceOrderStatusHistory: {
    create: vi.fn(),
  },
}

function configureAuthentication(
  user:
    | typeof ownerUser
    | typeof employeeUser
    | typeof adminUser
    | null,
) {
  vi.mocked(authenticate).mockImplementation(async (request, reply) => {
    if (!user) {
      return reply.status(401).send({
        message: 'Não autenticado.',
      })
    }

    request.authenticatedUser = user as never
  })

  vi.mocked(requireCompanyAccess).mockImplementation(
    async (request, reply) => {
      const authenticatedUser = request.authenticatedUser

      if (!authenticatedUser) {
        return reply.status(401).send({
          message: 'Não autenticado.',
        })
      }

      if (!authenticatedUser.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      if (authenticatedUser.company?.status === 'SUSPENDED') {
        return reply.status(403).send({
          message:
            'A empresa está suspensa. Entre em contato com o suporte.',
        })
      }
    },
  )
}

function configureTransaction() {
  txMock.client.findFirst.mockResolvedValue(client)

  txMock.company.update.mockResolvedValue({
    lastServiceOrderNumber: 1,
  })

  txMock.serviceOrder.create.mockResolvedValue(createdServiceOrder)

  vi.mocked(prisma.$transaction).mockImplementation(
    (async (callback: unknown) => {
      const transactionCallback = callback as (
        tx: typeof txMock,
      ) => Promise<unknown>

      return transactionCallback(txMock)
    }) as never,
  )
}

function configureListTransaction() {
  vi.mocked(prisma.serviceOrder.findMany).mockResolvedValue([
    listedServiceOrder,
  ] as never)

  vi.mocked(prisma.serviceOrder.count).mockResolvedValue(1)

  vi.mocked(prisma.$transaction).mockImplementation(
    (async (operations: unknown) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations)
      }

      const transactionCallback = operations as (
        tx: typeof txMock,
      ) => Promise<unknown>

      return transactionCallback(txMock)
    }) as never,
  )
}

async function createApp() {
  const app = Fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
      },
    },
  })

  app.decorateRequest('authenticatedUser', null)

  await app.register(serviceOrderRoutes)

  return app
}

describe('POST /service-orders', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('autenticação e autorização', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário é ADMIN', async () => {
      configureAuthentication(adminUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve bloquear usuários de empresas suspensas', async () => {
      configureAuthentication({
        ...ownerUser,
        company: {
          status: 'SUSPENDED',
        },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message:
            'A empresa está suspensa. Entre em contato com o suporte.',
        })
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('validação dos dados', () => {
    const invalidPayloads = [
      {
        description: 'sem cliente',
        payload: {
          ...validPayload,
          clientId: undefined,
        },
      },
      {
        description: 'sem marca',
        payload: {
          ...validPayload,
          deviceBrand: undefined,
        },
      },
      {
        description: 'sem modelo',
        payload: {
          ...validPayload,
          deviceModel: undefined,
        },
      },
      {
        description: 'sem problema relatado',
        payload: {
          ...validPayload,
          reportedProblem: undefined,
        },
      },
      {
        description: 'com cliente vazio',
        payload: {
          ...validPayload,
          clientId: '',
        },
      },
      {
        description: 'com marca contendo apenas espaços',
        payload: {
          ...validPayload,
          deviceBrand: '   ',
        },
      },
      {
        description: 'com modelo contendo apenas espaços',
        payload: {
          ...validPayload,
          deviceModel: '   ',
        },
      },
      {
        description: 'com problema contendo apenas espaços',
        payload: {
          ...validPayload,
          reportedProblem: '   ',
        },
      },
      {
        description: 'com marca maior que 80 caracteres',
        payload: {
          ...validPayload,
          deviceBrand: 'a'.repeat(81),
        },
      },
      {
        description: 'com modelo maior que 120 caracteres',
        payload: {
          ...validPayload,
          deviceModel: 'a'.repeat(121),
        },
      },
      {
        description: 'com problema maior que 2000 caracteres',
        payload: {
          ...validPayload,
          reportedProblem: 'a'.repeat(2001),
        },
      },
      {
        description: 'com data de entrega inválida',
        payload: {
          ...validPayload,
          expectedDeliveryAt: 'data-invalida',
        },
      },
      {
        description: 'com companyId não permitido',
        payload: {
          ...validPayload,
          companyId: 'outra-empresa',
        },
      },
      {
        description: 'com número de OS não permitido',
        payload: {
          ...validPayload,
          number: 999,
        },
      },
      {
        description: 'com status não permitido',
        payload: {
          ...validPayload,
          status: 'CONCLUIDO',
        },
      },
      {
        description: 'com responsável não permitido',
        payload: {
          ...validPayload,
          createdByUserId: 'outro-usuario',
        },
      },
      {
        description: 'com senha do aparelho não permitida',
        payload: {
          ...validPayload,
          devicePasswordEncrypted: 'senha',
        },
      },
      {
        description: 'com propriedade adicional não permitida',
        payload: {
          ...validPayload,
          outraPropriedade: 'valor',
        },
      },
    ]

    it.each(invalidPayloads)(
      'deve rejeitar a requisição $description',
      async ({ payload }) => {
        configureAuthentication(ownerUser)

        const app = await createApp()

        try {
          const response = await app.inject({
            method: 'POST',
            url: '/service-orders',
            payload,
          })

          expect(response.statusCode).toBe(400)
          expect(prisma.$transaction).not.toHaveBeenCalled()
        } finally {
          await app.close()
        }
      },
    )
  })

  describe('abertura bem-sucedida', () => {
    it('deve abrir uma OS para o cliente da empresa do OWNER', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)
        expect(response.json()).toEqual({
          serviceOrder: {
            ...createdServiceOrder,
            expectedDeliveryAt:
              createdServiceOrder.expectedDeliveryAt.toISOString(),
            createdAt: createdServiceOrder.createdAt.toISOString(),
            updatedAt: createdServiceOrder.updatedAt.toISOString(),
            statusHistory: [
              {
                ...createdServiceOrder.statusHistory[0],
                createdAt:
                  createdServiceOrder.statusHistory[0]!.createdAt.toISOString(),
              },
            ],
          },
        })

        expect(txMock.client.findFirst).toHaveBeenCalledWith({
          where: {
            id: validPayload.clientId,
            companyId: ownerUser.companyId,
          },
          select: {
            id: true,
            name: true,
            phone: true,
          },
        })

        expect(txMock.company.update).toHaveBeenCalledWith({
          where: {
            id: ownerUser.companyId,
          },
          data: {
            lastServiceOrderNumber: {
              increment: 1,
            },
          },
          select: {
            lastServiceOrderNumber: true,
          },
        })

        expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              companyId: ownerUser.companyId,
              number: 1,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone,
              createdByUserId: ownerUser.id,
              status: 'ENTRADA',
              statusHistory: {
                create: {
                  changedByUserId: ownerUser.id,
                  fromStatus: null,
                  toStatus: 'ENTRADA',
                },
              },
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve permitir que EMPLOYEE abra OS na própria empresa', async () => {
      configureAuthentication(employeeUser)
      configureTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)

        expect(txMock.company.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: employeeUser.companyId,
            },
          }),
        )

        expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              companyId: employeeUser.companyId,
              createdByUserId: employeeUser.id,
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve remover espaços extras dos dados do aparelho', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: {
            ...validPayload,
            deviceBrand: '  Apple  ',
            deviceModel: '  iPhone 13  ',
            deviceColor: '  Preto  ',
            reportedProblem: '  Não está carregando.  ',
          },
        })

        expect(response.statusCode).toBe(201)

        expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              deviceBrand: 'Apple',
              deviceModel: 'iPhone 13',
              deviceColor: 'Preto',
              reportedProblem: 'Não está carregando.',
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve permitir abrir OS sem cor, acessórios e previsão de entrega', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: {
            clientId: validPayload.clientId,
            deviceBrand: validPayload.deviceBrand,
            deviceModel: validPayload.deviceModel,
            reportedProblem: validPayload.reportedProblem,
          },
        })

        expect(response.statusCode).toBe(201)

        expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              deviceColor: null,
              accessories: [],
              expectedDeliveryAt: null,
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve gerar a numeração com o contador da empresa', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      txMock.company.update.mockResolvedValue({
        lastServiceOrderNumber: 15,
      })

      txMock.serviceOrder.create.mockResolvedValue({
        ...createdServiceOrder,
        number: 15,
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)
        expect(response.json().serviceOrder.number).toBe(15)

        expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              number: 15,
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('isolamento entre empresas', () => {
    it('deve retornar 404 quando o cliente não pertence à empresa do usuário', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      txMock.client.findFirst.mockResolvedValue(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          message: 'Cliente não encontrado.',
        })

        expect(txMock.client.findFirst).toHaveBeenCalledWith({
          where: {
            id: validPayload.clientId,
            companyId: ownerUser.companyId,
          },
          select: {
            id: true,
            name: true,
            phone: true,
          },
        })

        expect(txMock.company.update).not.toHaveBeenCalled()
        expect(txMock.serviceOrder.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve utilizar os dados do cliente encontrado no banco', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      txMock.client.findFirst.mockResolvedValue({
        id: client.id,
        name: 'Maria Atualizada',
        phone: '67988888888',
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)

        expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              clientName: 'Maria Atualizada',
              clientPhone: '67988888888',
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas na transação', () => {
    it('deve retornar 503 quando o banco apresenta uma falha', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível abrir a ordem de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      } finally {
        await app.close()
      }
    })

    it('não deve incrementar o contador quando o cliente não é encontrado', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      txMock.client.findFirst.mockResolvedValue(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(404)
        expect(txMock.company.update).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 503 quando ocorre falha ao criar a OS', async () => {
      configureAuthentication(ownerUser)
      configureTransaction()

      txMock.serviceOrder.create.mockRejectedValue(
        new Error('Falha ao criar ordem de serviço'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/service-orders',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(txMock.company.update).toHaveBeenCalled()
        expect(txMock.serviceOrder.create).toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })
})

describe('GET /service-orders', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('autenticação e autorização', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário é ADMIN', async () => {
      configureAuthentication(adminUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve bloquear usuários de empresas suspensas', async () => {
      configureAuthentication({
        ...ownerUser,
        company: {
          status: 'SUSPENDED',
        },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve permitir que EMPLOYEE consulte as OS da própria empresa', async () => {
      configureAuthentication(employeeUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(200)

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              companyId: employeeUser.companyId,
            },
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('listagem e paginação', () => {
    it('deve listar as OS com paginação padrão', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
          serviceOrders: [
            {
              ...listedServiceOrder,
              expectedDeliveryAt:
                listedServiceOrder.expectedDeliveryAt.toISOString(),
              createdAt: listedServiceOrder.createdAt.toISOString(),
              updatedAt: listedServiceOrder.updatedAt.toISOString(),
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        })

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              companyId: ownerUser.companyId,
            },
            skip: 0,
            take: 10,
            orderBy: {
              createdAt: 'desc',
            },
          }),
        )

        expect(prisma.serviceOrder.count).toHaveBeenCalledWith({
          where: {
            companyId: ownerUser.companyId,
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve respeitar a página e o limite informados', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?page=2&limit=5',
        })

        expect(response.statusCode).toBe(200)
        expect(response.json().pagination).toEqual({
          page: 2,
          limit: 5,
          total: 1,
          totalPages: 1,
        })

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 5,
            take: 5,
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar zero páginas quando não houver ordens', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      vi.mocked(prisma.serviceOrder.findMany).mockResolvedValue([])
      vi.mocked(prisma.serviceOrder.count).mockResolvedValue(0)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
          serviceOrders: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        })
      } finally {
        await app.close()
      }
    })
  })

  describe('filtros e busca', () => {
    it('deve filtrar as ordens pelo status', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?status=ENTRADA',
        })

        expect(response.statusCode).toBe(200)

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              companyId: ownerUser.companyId,
              status: 'ENTRADA',
            },
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve buscar pelo número da OS', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?search=1',
        })

        expect(response.statusCode).toBe(200)

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              companyId: ownerUser.companyId,
              OR: [
                {
                  number: 1,
                },
                {
                  clientName: {
                    contains: '1',
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve buscar pelo nome do cliente sem diferenciar maiúsculas e minúsculas', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?search=maria',
        })

        expect(response.statusCode).toBe(200)

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              companyId: ownerUser.companyId,
              OR: [
                {
                  clientName: {
                    contains: 'maria',
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve combinar o filtro de status com a busca', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?status=ENTRADA&search=Maria',
        })

        expect(response.statusCode).toBe(200)

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              companyId: ownerUser.companyId,
              status: 'ENTRADA',
              OR: [
                {
                  clientName: {
                    contains: 'Maria',
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('isolamento entre empresas', () => {
    it('deve utilizar sempre a empresa do usuário autenticado', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?companyId=outra-empresa',
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve utilizar o companyId do usuário na consulta ao banco', async () => {
      configureAuthentication(ownerUser)
      configureListTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(200)

        expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              companyId: ownerUser.companyId,
            }),
          }),
        )

        expect(prisma.serviceOrder.count).toHaveBeenCalledWith({
          where: {
            companyId: ownerUser.companyId,
          },
        })
      } finally {
        await app.close()
      }
    })
  })

  describe('validação dos parâmetros', () => {
    const invalidQueries = [
      'page=0',
      'page=-1',
      'page=abc',
      'limit=0',
      'limit=-1',
      'limit=101',
      'limit=abc',
      'status=INVALIDO',
      `search=${'a'.repeat(121)}`,
      'companyId=outra-empresa',
      'orderBy=number',
    ]

    it.each(invalidQueries)(
      'deve rejeitar parâmetros inválidos: %s',
      async (query) => {
        configureAuthentication(ownerUser)

        const app = await createApp()

        try {
          const response = await app.inject({
            method: 'GET',
            url: `/service-orders?${query}`,
          })

          expect(response.statusCode).toBe(400)
          expect(prisma.$transaction).not.toHaveBeenCalled()
        } finally {
          await app.close()
        }
      },
    )

    it('deve rejeitar limite maior que 100', async () => {
      configureAuthentication(ownerUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders?limit=101',
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas na consulta', () => {
    it('deve retornar 503 quando ocorre falha no banco', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders',
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível consultar as ordens de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      } finally {
        await app.close()
      }
    })
  })
})


describe('GET /service-orders/:id', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  const detailedServiceOrder = {
    id: createdServiceOrder.id,
    companyId: ownerUser.companyId,
    number: createdServiceOrder.number,
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone,
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
    },
    deviceBrand: createdServiceOrder.deviceBrand,
    deviceModel: createdServiceOrder.deviceModel,
    deviceColor: createdServiceOrder.deviceColor,
    accessories: createdServiceOrder.accessories,
    reportedProblem: createdServiceOrder.reportedProblem,
    diagnosis: 'Conector de carga com defeito.',
    estimatedPrice: '150.00',
    status: 'ENTRADA',
    expectedDeliveryAt: createdServiceOrder.expectedDeliveryAt,
    completedAt: null,
    canceledAt: null,
    cancellationReason: null,
    warrantyDays: null,
    previousServiceOrderId: null,
    createdBy: {
      id: ownerUser.id,
      name: ownerUser.name,
    },
    statusHistory: [
      {
        id: 'history-1',
        fromStatus: null,
        toStatus: 'ENTRADA',
        reason: null,
        createdAt: createdServiceOrder.createdAt,
        changedBy: {
          id: ownerUser.id,
          name: ownerUser.name,
        },
      },
    ],
    createdAt: createdServiceOrder.createdAt,
    updatedAt: createdServiceOrder.updatedAt,
  }

  function configureDetailQuery(
    result: typeof detailedServiceOrder | null = detailedServiceOrder,
  ) {
    vi.mocked(prisma.serviceOrder.findFirst).mockResolvedValue(
      result as never,
    )
  }

  describe('autenticação e autorização', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}`,
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.serviceOrder.findFirst).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário é ADMIN', async () => {
      configureAuthentication(adminUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}`,
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.serviceOrder.findFirst).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve bloquear usuários de empresas suspensas', async () => {
      configureAuthentication({
        ...ownerUser,
        company: {
          status: 'SUSPENDED',
        },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}`,
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.serviceOrder.findFirst).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('consulta dos detalhes', () => {
    it('deve retornar os detalhes da OS com cliente e histórico de status', async () => {
      configureAuthentication(ownerUser)
      configureDetailQuery()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}`,
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
          serviceOrder: {
            ...detailedServiceOrder,
            expectedDeliveryAt:
              detailedServiceOrder.expectedDeliveryAt.toISOString(),
            createdAt: detailedServiceOrder.createdAt.toISOString(),
            updatedAt: detailedServiceOrder.updatedAt.toISOString(),
            statusHistory: [
              {
                ...detailedServiceOrder.statusHistory[0],
                createdAt:
                  detailedServiceOrder.statusHistory[0]!.createdAt.toISOString(),
              },
            ],
          },
        })

        expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith({
          where: {
            id: createdServiceOrder.id,
            companyId: ownerUser.companyId,
          },
          select: expect.objectContaining({
            id: true,
            client: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            statusHistory: expect.objectContaining({
              orderBy: {
                createdAt: 'asc',
              },
            }),
          }),
        })
      } finally {
        await app.close()
      }
    })

    it('deve permitir que EMPLOYEE consulte OS da própria empresa', async () => {
      configureAuthentication(employeeUser)
      configureDetailQuery()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}`,
        })

        expect(response.statusCode).toBe(200)
        expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: createdServiceOrder.id,
              companyId: employeeUser.companyId,
            },
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar 404 quando a OS não existe', async () => {
      configureAuthentication(ownerUser)
      configureDetailQuery(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders/os-inexistente',
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          message: 'Ordem de serviço não encontrada.',
        })
      } finally {
        await app.close()
      }
    })
  })

  describe('isolamento entre empresas', () => {
    it('deve retornar 404 quando a OS não pertence à empresa do usuário', async () => {
      configureAuthentication(ownerUser)
      configureDetailQuery(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/service-orders/os-de-outra-empresa',
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          message: 'Ordem de serviço não encontrada.',
        })

        expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: 'os-de-outra-empresa',
              companyId: ownerUser.companyId,
            },
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve ignorar companyId informado na URL e utilizar a empresa do usuário autenticado', async () => {
      configureAuthentication(ownerUser)
      configureDetailQuery()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}?companyId=outra-empresa`,
        })

        expect(response.statusCode).toBe(200)
        expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: createdServiceOrder.id,
              companyId: ownerUser.companyId,
            },
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas na consulta', () => {
    it('deve retornar 503 quando ocorre falha no banco', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.serviceOrder.findFirst).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/service-orders/${createdServiceOrder.id}`,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível consultar os detalhes da ordem de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      } finally {
        await app.close()
      }
    })
  })
})


describe('PATCH /service-orders/:id/status', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  const updatedServiceOrder: {
  id: string
  number: number
  status: string
  completedAt: Date | null
  canceledAt: Date | null
  cancellationReason: string | null
  updatedAt: Date
  statusHistory: {
    id: string
    fromStatus: string | null
    toStatus: string
    reason: string | null
    createdAt: Date
    changedBy: {
      id: string
      name: string
    }
  }[]
} = {
    id: createdServiceOrder.id,
    number: createdServiceOrder.number,
    status: 'EM_ANDAMENTO',
    completedAt: null,
    canceledAt: null,
    cancellationReason: null,
    updatedAt: new Date('2026-10-31T11:00:00.000Z'),
    statusHistory: [
      {
        id: 'history-1',
        fromStatus: null,
        toStatus: 'ENTRADA',
        reason: null,
        createdAt: createdServiceOrder.createdAt,
        changedBy: {
          id: ownerUser.id,
          name: ownerUser.name,
        },
      },
      {
        id: 'history-2',
        fromStatus: 'ENTRADA',
        toStatus: 'EM_ANDAMENTO',
        reason: null,
        createdAt: new Date('2026-10-31T11:00:00.000Z'),
        changedBy: {
          id: ownerUser.id,
          name: ownerUser.name,
        },
      },
    ],
  }

  function configureStatusTransaction({
    currentStatus = 'ENTRADA',
    updatedOrder = updatedServiceOrder,
    updateCount = 1,
  }: {
    currentStatus?: string
    updatedOrder?: typeof updatedServiceOrder | null
    updateCount?: number
  } = {}) {
    txMock.serviceOrder.findFirst.mockReset()
    txMock.serviceOrder.updateMany.mockReset()
    txMock.serviceOrderStatusHistory.create.mockReset()

    txMock.serviceOrder.findFirst
      .mockResolvedValueOnce({
        id: createdServiceOrder.id,
        status: currentStatus,
      })
      .mockResolvedValueOnce(updatedOrder)

    txMock.serviceOrder.updateMany.mockResolvedValue({
      count: updateCount,
    })

    txMock.serviceOrderStatusHistory.create.mockResolvedValue({
      id: 'history-2',
    })

    vi.mocked(prisma.$transaction).mockImplementation(
      (async (callback: unknown) => {
        const transactionCallback = callback as (
          tx: typeof txMock,
        ) => Promise<unknown>

        return transactionCallback(txMock)
      }) as never,
    )
  }

  describe('autenticação e autorização', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário é ADMIN', async () => {
      configureAuthentication(adminUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve bloquear usuários de empresas suspensas', async () => {
      configureAuthentication({
        ...ownerUser,
        company: { status: 'SUSPENDED' },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('validação', () => {
    it('deve rejeitar status inválido', async () => {
      configureAuthentication(ownerUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'AGUARDANDO_PECAS' },
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve exigir justificativa para cancelamento', async () => {
      configureAuthentication(ownerUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'CANCELADO' },
        })

        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({
          message:
            'Informe uma justificativa para cancelar a ordem de serviço.',
        })
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve rejeitar justificativa quando o status não é CANCELADO', async () => {
      configureAuthentication(ownerUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: {
            status: 'EM_ANDAMENTO',
            reason: 'Justificativa indevida',
          },
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('atualização bem-sucedida', () => {
    it('deve permitir ENTRADA para EM_ANDAMENTO e registrar o histórico', async () => {
      configureAuthentication(ownerUser)
      configureStatusTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json().serviceOrder.status).toBe('EM_ANDAMENTO')

        expect(txMock.serviceOrder.findFirst).toHaveBeenNthCalledWith(1, {
          where: {
            id: createdServiceOrder.id,
            companyId: ownerUser.companyId,
          },
          select: {
            id: true,
            status: true,
          },
        })

        expect(txMock.serviceOrder.updateMany).toHaveBeenCalledWith({
          where: {
            id: createdServiceOrder.id,
            companyId: ownerUser.companyId,
            status: 'ENTRADA',
          },
          data: {
            status: 'EM_ANDAMENTO',
          },
        })

        expect(txMock.serviceOrderStatusHistory.create).toHaveBeenCalledWith({
          data: {
            serviceOrderId: createdServiceOrder.id,
            changedByUserId: ownerUser.id,
            fromStatus: 'ENTRADA',
            toStatus: 'EM_ANDAMENTO',
            reason: null,
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve permitir EM_ANDAMENTO para CONCLUIDO e preencher completedAt', async () => {
      configureAuthentication(ownerUser)
      configureStatusTransaction({
        currentStatus: 'EM_ANDAMENTO',
        updatedOrder: {
          ...updatedServiceOrder,
          status: 'CONCLUIDO',
          completedAt: new Date('2026-10-31T11:00:00.000Z'),
        },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'CONCLUIDO' },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json().serviceOrder.status).toBe('CONCLUIDO')

        expect(txMock.serviceOrder.updateMany).toHaveBeenCalledWith({
          where: {
            id: createdServiceOrder.id,
            companyId: ownerUser.companyId,
            status: 'EM_ANDAMENTO',
          },
          data: expect.objectContaining({
            status: 'CONCLUIDO',
            completedAt: expect.any(Date),
          }),
        })

        expect(txMock.serviceOrderStatusHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            fromStatus: 'EM_ANDAMENTO',
            toStatus: 'CONCLUIDO',
            changedByUserId: ownerUser.id,
          }),
        })
      } finally {
        await app.close()
      }
    })

    it('deve permitir cancelamento com justificativa e registrar o motivo', async () => {
      configureAuthentication(employeeUser)
      configureStatusTransaction({
        updatedOrder: {
          ...updatedServiceOrder,
          status: 'CANCELADO',
          canceledAt: new Date('2026-10-31T11:00:00.000Z'),
          cancellationReason: 'Cliente desistiu do reparo.',
        },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: {
            status: 'CANCELADO',
            reason: '  Cliente desistiu do reparo.  ',
          },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json().serviceOrder.status).toBe('CANCELADO')

        expect(txMock.serviceOrder.updateMany).toHaveBeenCalledWith({
          where: {
            id: createdServiceOrder.id,
            companyId: employeeUser.companyId,
            status: 'ENTRADA',
          },
          data: expect.objectContaining({
            status: 'CANCELADO',
            canceledAt: expect.any(Date),
            cancellationReason: 'Cliente desistiu do reparo.',
          }),
        })

        expect(txMock.serviceOrderStatusHistory.create).toHaveBeenCalledWith({
          data: {
            serviceOrderId: createdServiceOrder.id,
            changedByUserId: employeeUser.id,
            fromStatus: 'ENTRADA',
            toStatus: 'CANCELADO',
            reason: 'Cliente desistiu do reparo.',
          },
        })
      } finally {
        await app.close()
      }
    })
  })

  describe('regras de transição e isolamento', () => {
    it.each([
      ['CONCLUIDO', 'EM_ANDAMENTO'],
      ['CANCELADO', 'EM_ANDAMENTO'],
      ['ENTRADA', 'CONCLUIDO'],
    ])(
      'deve impedir a transição de %s para %s',
      async (currentStatus, requestedStatus) => {
        configureAuthentication(ownerUser)
        configureStatusTransaction({
          currentStatus,
        })

        const app = await createApp()

        try {
          const response = await app.inject({
            method: 'PATCH',
            url: `/service-orders/${createdServiceOrder.id}/status`,
            payload: { status: requestedStatus },
          })

          expect(response.statusCode).toBe(409)
          expect(txMock.serviceOrder.updateMany).not.toHaveBeenCalled()
          expect(
            txMock.serviceOrderStatusHistory.create,
          ).not.toHaveBeenCalled()
        } finally {
          await app.close()
        }
      },
    )

    it('deve retornar 404 quando a OS não existe ou pertence a outra empresa', async () => {
      configureAuthentication(ownerUser)
      configureStatusTransaction()
      txMock.serviceOrder.findFirst.mockReset()
      txMock.serviceOrder.findFirst.mockResolvedValue(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: '/service-orders/os-de-outra-empresa/status',
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(404)
        expect(txMock.serviceOrder.findFirst).toHaveBeenCalledWith({
          where: {
            id: 'os-de-outra-empresa',
            companyId: ownerUser.companyId,
          },
          select: {
            id: true,
            status: true,
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve retornar 409 quando a OS foi alterada simultaneamente', async () => {
      configureAuthentication(ownerUser)
      configureStatusTransaction({ updateCount: 0 })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(409)
        expect(txMock.serviceOrderStatusHistory.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas na atualização', () => {
    it('deve retornar 503 quando ocorre falha no banco', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'PATCH',
          url: `/service-orders/${createdServiceOrder.id}/status`,
          payload: { status: 'EM_ANDAMENTO' },
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível atualizar o status da ordem de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      } finally {
        await app.close()
      }
    })
  })
})
