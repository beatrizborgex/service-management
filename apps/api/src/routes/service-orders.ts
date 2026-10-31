import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import {
  authenticate,
  requireCompanyAccess,
} from '../lib/auth'

class ClientNotFoundError extends Error {
  constructor() {
    super('Cliente não encontrado.')
    this.name = 'ClientNotFoundError'
  }
}

class ServiceOrderNotFoundError extends Error {
  constructor() {
    super('Ordem de serviço não encontrada.')
    this.name = 'ServiceOrderNotFoundError'
  }
}

class InvalidStatusTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidStatusTransitionError'
  }
}

class ConcurrentStatusUpdateError extends Error {
  constructor() {
    super('A ordem de serviço foi atualizada por outra requisição. Consulte o status atual e tente novamente.')
    this.name = 'ConcurrentStatusUpdateError'
  }
}

const serviceOrderStatuses = [
  'ENTRADA',
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'CANCELADO',
] as const

type ServiceOrderStatus = (typeof serviceOrderStatuses)[number]

const allowedStatusTransitions: Record<
  ServiceOrderStatus,
  ServiceOrderStatus[]
> = {
  ENTRADA: ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
}

export async function serviceOrderRoutes(app: FastifyInstance) {
  app.post(
    '/service-orders',
    {
      preHandler: [authenticate, requireCompanyAccess],
      schema: {
        body: {
          type: 'object',
          required: [
            'clientId',
            'deviceBrand',
            'deviceModel',
            'reportedProblem',
          ],
          additionalProperties: false,
          properties: {
            clientId: {
              type: 'string',
              minLength: 1,
              pattern: '\\S',
            },
            deviceBrand: {
              type: 'string',
              minLength: 1,
              maxLength: 80,
              pattern: '\\S',
            },
            deviceModel: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              pattern: '\\S',
            },
            deviceColor: {
              type: 'string',
              maxLength: 60,
            },
            accessories: {
              type: 'array',
              maxItems: 30,
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 80,
                pattern: '\\S',
              },
            },
            reportedProblem: {
              type: 'string',
              minLength: 1,
              maxLength: 2000,
              pattern: '\\S',
            },
            expectedDeliveryAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!

      if (user.role !== 'OWNER' && user.role !== 'EMPLOYEE') {
        return reply.status(403).send({
          message:
            'Apenas proprietários e funcionários podem abrir ordens de serviço.',
        })
      }

      if (!user.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      const body = request.body as {
        clientId: string
        deviceBrand: string
        deviceModel: string
        deviceColor?: string
        accessories?: string[]
        reportedProblem: string
        expectedDeliveryAt?: string
      }

      const deviceBrand = body.deviceBrand.trim()
      const deviceModel = body.deviceModel.trim()
      const deviceColor = body.deviceColor?.trim() || null
      const reportedProblem = body.reportedProblem.trim()

      if (
        !deviceBrand ||
        !deviceModel ||
        !reportedProblem ||
        !body.clientId.trim()
      ) {
        return reply.status(400).send({
          message:
            'Informe o cliente, a marca, o modelo e o problema relatado.',
        })
      }

      try {
        const serviceOrder = await prisma.$transaction(async (tx) => {
          const client = await tx.client.findFirst({
            where: {
              id: body.clientId,
              companyId: user.companyId!,
            },
            select: {
              id: true,
              name: true,
              phone: true,
            },
          })

          if (!client) {
            throw new ClientNotFoundError()
          }

          const company = await tx.company.update({
            where: {
              id: user.companyId!,
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

          return tx.serviceOrder.create({
            data: {
              companyId: user.companyId!,
              number: company.lastServiceOrderNumber,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone,
              deviceBrand,
              deviceModel,
              deviceColor,
              accessories: body.accessories ?? [],
              reportedProblem,
              expectedDeliveryAt: body.expectedDeliveryAt
                ? new Date(body.expectedDeliveryAt)
                : null,
              createdByUserId: user.id,
              status: 'ENTRADA',
              statusHistory: {
                create: {
                  changedByUserId: user.id,
                  fromStatus: null,
                  toStatus: 'ENTRADA',
                },
              },
            },
            select: {
              id: true,
              companyId: true,
              number: true,
              clientId: true,
              clientName: true,
              clientPhone: true,
              deviceBrand: true,
              deviceModel: true,
              deviceColor: true,
              accessories: true,
              reportedProblem: true,
              status: true,
              expectedDeliveryAt: true,
              createdByUserId: true,
              createdAt: true,
              updatedAt: true,
              statusHistory: {
                select: {
                  id: true,
                  fromStatus: true,
                  toStatus: true,
                  changedByUserId: true,
                  createdAt: true,
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          })
        })

        return reply.status(201).send({
          serviceOrder,
        })
      } catch (error) {
        if (error instanceof ClientNotFoundError) {
          return reply.status(404).send({
            message: error.message,
          })
        }

        request.log.error(
          { err: error },
          'Não foi possível abrir a ordem de serviço.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível abrir a ordem de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )

  app.get(
    '/service-orders',
    {
      preHandler: [authenticate, requireCompanyAccess],
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: {
              type: 'string',
              pattern: '^[1-9]\\d*$',
            },
            limit: {
              type: 'string',
              pattern: '^[1-9]\\d*$',
            },
            status: {
              type: 'string',
              enum: [...serviceOrderStatuses],
            },
            search: {
              type: 'string',
              maxLength: 120,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!

      if (user.role !== 'OWNER' && user.role !== 'EMPLOYEE') {
        return reply.status(403).send({
          message:
            'Apenas proprietários e funcionários podem consultar ordens de serviço.',
        })
      }

      if (!user.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      const query = request.query as {
        page?: string
        limit?: string
        status?: ServiceOrderStatus
        search?: string
      }

      const page = Number(query.page ?? 1)
      const limit = Number(query.limit ?? 10)

      if (
        !Number.isSafeInteger(page) ||
        !Number.isSafeInteger(limit) ||
        page < 1 ||
        limit < 1 ||
        limit > 100
      ) {
        return reply.status(400).send({
          message:
            'Informe uma página válida e um limite entre 1 e 100.',
        })
      }

      const search = query.search?.trim()

      try {
        const where = {
          companyId: user.companyId,
          ...(query.status ? { status: query.status } : {}),
          ...(search
            ? {
                OR: [
                  ...(Number.isSafeInteger(Number(search)) &&
                  Number(search) > 0
                    ? [{ number: Number(search) }]
                    : []),
                  {
                    clientName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        }

        const [serviceOrders, total] = await prisma.$transaction([
          prisma.serviceOrder.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              number: true,
              clientId: true,
              clientName: true,
              clientPhone: true,
              deviceBrand: true,
              deviceModel: true,
              deviceColor: true,
              accessories: true,
              reportedProblem: true,
              status: true,
              expectedDeliveryAt: true,
              completedAt: true,
              canceledAt: true,
              cancellationReason: true,
              warrantyDays: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          prisma.serviceOrder.count({
            where,
          }),
        ])

        return reply.status(200).send({
          serviceOrders,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        })
      } catch (error) {
        request.log.error(
          { err: error },
          'Não foi possível consultar as ordens de serviço.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível consultar as ordens de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )

  app.get(
    '/service-orders/:id',
    {
      preHandler: [authenticate, requireCompanyAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              minLength: 1,
              pattern: '\\S',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!

      if (user.role !== 'OWNER' && user.role !== 'EMPLOYEE') {
        return reply.status(403).send({
          message:
            'Apenas proprietários e funcionários podem consultar ordens de serviço.',
        })
      }

      if (!user.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      const { id } = request.params as {
        id: string
      }

      try {
        const serviceOrder = await prisma.serviceOrder.findFirst({
          where: {
            id,
            companyId: user.companyId,
          },
          select: {
            id: true,
            companyId: true,
            number: true,

            clientId: true,
            clientName: true,
            clientPhone: true,

            client: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },

            deviceBrand: true,
            deviceModel: true,
            deviceColor: true,
            accessories: true,
            reportedProblem: true,
            diagnosis: true,
            estimatedPrice: true,

            status: true,
            expectedDeliveryAt: true,
            completedAt: true,
            canceledAt: true,
            cancellationReason: true,
            warrantyDays: true,

            previousServiceOrderId: true,

            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },

            statusHistory: {
              select: {
                id: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                createdAt: true,
                changedBy: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },

            createdAt: true,
            updatedAt: true,
          },
        })

        if (!serviceOrder) {
          return reply.status(404).send({
            message: 'Ordem de serviço não encontrada.',
          })
        }

        return reply.status(200).send({
          serviceOrder,
        })
      } catch (error) {
        request.log.error(
          { err: error },
          'Não foi possível consultar os detalhes da ordem de serviço.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível consultar os detalhes da ordem de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )

  app.patch(
    '/service-orders/:id/status',
    {
      preHandler: [authenticate, requireCompanyAccess],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              minLength: 1,
              pattern: '\\S',
            },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: {
              type: 'string',
              enum: [...serviceOrderStatuses],
            },
            reason: {
              type: 'string',
              minLength: 1,
              maxLength: 500,
              pattern: '\\S',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser!

      if (user.role !== 'OWNER' && user.role !== 'EMPLOYEE') {
        return reply.status(403).send({
          message:
            'Apenas proprietários e funcionários podem atualizar ordens de serviço.',
        })
      }

      if (!user.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      const { id } = request.params as {
        id: string
      }

      const body = request.body as {
        status: ServiceOrderStatus
        reason?: string
      }

      const reason = body.reason?.trim() || null

      if (body.status === 'CANCELADO' && !reason) {
        return reply.status(400).send({
          message: 'Informe uma justificativa para cancelar a ordem de serviço.',
        })
      }

      if (body.status !== 'CANCELADO' && reason) {
        return reply.status(400).send({
          message: 'A justificativa só deve ser informada ao cancelar a ordem de serviço.',
        })
      }

      try {
        const serviceOrder = await prisma.$transaction(async (tx) => {
          const currentServiceOrder = await tx.serviceOrder.findFirst({
            where: {
              id,
              companyId: user.companyId!,
            },
            select: {
              id: true,
              status: true,
            },
          })

          if (!currentServiceOrder) {
            throw new ServiceOrderNotFoundError()
          }

          const currentStatus =
            currentServiceOrder.status as ServiceOrderStatus

          const allowedTransitions =
            allowedStatusTransitions[currentStatus]

          if (!allowedTransitions.includes(body.status)) {
            throw new InvalidStatusTransitionError(
              `Não é permitido alterar o status de ${currentStatus} para ${body.status}.`,
            )
          }

          const now = new Date()

          const updateResult = await tx.serviceOrder.updateMany({
            where: {
              id,
              companyId: user.companyId!,
              status: currentStatus,
            },
            data: {
              status: body.status,
              ...(body.status === 'CONCLUIDO'
                ? { completedAt: now }
                : {}),
              ...(body.status === 'CANCELADO'
                ? {
                    canceledAt: now,
                    cancellationReason: reason,
                  }
                : {}),
            },
          })

          if (updateResult.count !== 1) {
            throw new ConcurrentStatusUpdateError()
          }

          await tx.serviceOrderStatusHistory.create({
            data: {
              serviceOrderId: id,
              changedByUserId: user.id,
              fromStatus: currentStatus,
              toStatus: body.status,
              reason: body.status === 'CANCELADO' ? reason : null,
            },
          })

          return tx.serviceOrder.findFirst({
            where: {
              id,
              companyId: user.companyId!,
            },
            select: {
              id: true,
              number: true,
              status: true,
              completedAt: true,
              canceledAt: true,
              cancellationReason: true,
              updatedAt: true,
              statusHistory: {
                select: {
                  id: true,
                  fromStatus: true,
                  toStatus: true,
                  reason: true,
                  createdAt: true,
                  changedBy: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          })
        })

        return reply.status(200).send({
          serviceOrder,
        })
      } catch (error) {
        if (
          error instanceof ServiceOrderNotFoundError ||
          error instanceof InvalidStatusTransitionError ||
          error instanceof ConcurrentStatusUpdateError
        ) {
          const statusCode =
            error instanceof ServiceOrderNotFoundError
              ? 404
              : error instanceof InvalidStatusTransitionError
                ? 409
                : 409

          return reply.status(statusCode).send({
            message: error.message,
          })
        }

        request.log.error(
          { err: error },
          'Não foi possível atualizar o status da ordem de serviço.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível atualizar o status da ordem de serviço devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )
}
