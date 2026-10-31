
import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import {
  authenticate,
  requireCompanyAccess,
} from '../lib/auth'

export async function clientRoutes(app: FastifyInstance) {
  app.post(
    '/clients',
    {
      preHandler: [authenticate, requireCompanyAccess],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'phone'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              pattern: '\\S',
            },
            phone: {
              type: 'string',
              minLength: 1,
              maxLength: 30,
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
          message: 'Apenas proprietários e funcionários podem cadastrar clientes.',
        })
      }

      if (!user.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      const body = request.body as {
        name: string
        phone: string
      }

      const name = body.name.trim()
      const phone = body.phone.trim()

      if (!name || !phone) {
        return reply.status(400).send({
          message: 'Informe o nome e o telefone do cliente.',
        })
      }

      try {
        const client = await prisma.client.create({
          data: {
            name,
            phone,
            companyId: user.companyId,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            companyId: true,
            createdAt: true,
          },
        })

        return reply.status(201).send({
          client,
        })
      } catch (error) {
        request.log.error(
          { err: error },
          'Não foi possível cadastrar o cliente.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível cadastrar o cliente devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )

  app.get(
    '/clients',
    {
      preHandler: [authenticate, requireCompanyAccess],
    },
    async (request, reply) => {
      const user = request.authenticatedUser!

      if (user.role !== 'OWNER' && user.role !== 'EMPLOYEE') {
        return reply.status(403).send({
          message: 'Apenas proprietários e funcionários podem consultar clientes.',
        })
      }

      if (!user.companyId) {
        return reply.status(403).send({
          message: 'Usuário sem empresa vinculada.',
        })
      }

      try {
        const clients = await prisma.client.findMany({
          where: {
            companyId: user.companyId,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            companyId: true,
            createdAt: true,
          },
          orderBy: {
            name: 'asc',
          },
        })

        return reply.status(200).send({
          clients,
        })
      } catch (error) {
        request.log.error(
          { err: error },
          'Não foi possível consultar os clientes.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível consultar os clientes devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )
}
