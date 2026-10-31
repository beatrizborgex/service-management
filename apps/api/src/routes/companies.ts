
import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import {
  authenticate,
  requireAdmin,
  requireCompanyAccess,
} from '../lib/auth'

export async function companyRoutes(app: FastifyInstance) {
  app.get(
    '/companies/count',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async () => {
      const total = await prisma.company.count()

      return { total }
    },
  )

  app.get(
    '/companies',
    {
      preHandler: [authenticate, requireCompanyAccess],
    },
    async (request) => {
      const user = request.authenticatedUser!

      const companies = await prisma.company.findMany({
        where:
          user.role === 'ADMIN'
            ? {}
            : {
                id: user.companyId!,
              },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return { companies }
    },
  )

  app.post(
    '/companies',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              pattern: '\\S',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { name: string }
      const name = body.name.trim()

      if (!name) {
        return reply.status(400).send({
          message: 'O nome da empresa é obrigatório.',
        })
      }

      const company = await prisma.company.create({
        data: {
          name,
        },
      })

      return reply.status(201).send(company)
    },
  )
}
