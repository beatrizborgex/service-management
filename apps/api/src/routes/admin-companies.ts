
import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import {
  authenticate,
  requireAdmin,
} from '../lib/auth'
import supabaseAdmin from '../lib/supabase-admin'

export async function adminCompanyRoutes(app: FastifyInstance) {
  app.patch(
    '/admin/companies/:companyId/status',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        params: {
          type: 'object',
          required: ['companyId'],
          additionalProperties: false,
          properties: {
            companyId: {
              type: 'string',
              minLength: 1,
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
              enum: ['ACTIVE', 'SUSPENDED'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { companyId } = request.params as {
        companyId: string
      }

      const { status } = request.body as {
        status: 'ACTIVE' | 'SUSPENDED'
      }

      let result

      try {
        result = await prisma.company.updateMany({
          where: {
            id: companyId,
          },
          data: {
            status,
          },
        })
      } catch (error) {
        request.log.error(
          { err: error },
          'Não foi possível atualizar o status da empresa.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível atualizar o status da empresa. Tente novamente.',
        })
      }

      if (result.count === 0) {
        return reply.status(404).send({
          message: 'Empresa não encontrada.',
        })
      }

      return reply.status(200).send({
        companyId,
        status,
      })
    },
  )

  app.post(
    '/admin/companies',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        body: {
          type: 'object',
          required: [
            'companyName',
            'ownerName',
            'ownerEmail',
            'ownerPassword',
          ],
          additionalProperties: false,
          properties: {
            companyName: {
              type: 'string',
              minLength: 1,
              pattern: '\\S',
              maxLength: 120,
            },
            ownerName: {
              type: 'string',
              minLength: 1,
              pattern: '\\S',
              maxLength: 120,
            },
            ownerEmail: {
              type: 'string',
              format: 'email',
              maxLength: 254,
            },
            ownerPassword: {
              type: 'string',
              minLength: 8,
              maxLength: 128,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        companyName: string
        ownerName: string
        ownerEmail: string
        ownerPassword: string
      }

      const companyName = body.companyName.trim()
      const ownerName = body.ownerName.trim()
      const ownerEmail = body.ownerEmail.trim().toLowerCase()

      if (!companyName || !ownerName || !ownerEmail) {
        return reply.status(400).send({
          message:
            'Informe o nome da empresa e os dados do proprietário.',
        })
      }

      let authData
      let authError

      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email: ownerEmail,
          password: body.ownerPassword,
          email_confirm: true,
          user_metadata: {
            name: ownerName,
          },
        })

        authData = result.data
        authError = result.error
      } catch (error) {
        request.log.error(
          { err: error },
          'Erro inesperado ao criar a conta de autenticação do proprietário.',
        )

        return reply.status(503).send({
          message:
            'Serviço de autenticação temporariamente indisponível. Tente novamente.',
        })
      }

      if (authError || !authData.user) {
        return reply.status(400).send({
          message:
            'Não foi possível criar a conta do proprietário. Verifique o e-mail informado.',
        })
      }

      try {
        const result = await prisma.$transaction(async (transaction) => {
          const company = await transaction.company.create({
            data: {
              name: companyName,
            },
          })

          const owner = await transaction.user.create({
            data: {
              supabaseUserId: authData.user.id,
              name: ownerName,
              email: ownerEmail,
              role: 'OWNER',
              companyId: company.id,
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              companyId: true,
            },
          })

          return { company, owner }
        })

        return reply.status(201).send(result)
      } catch (error) {
        request.log.error(
          { err: error },
          'Não foi possível salvar a empresa e o proprietário no banco de dados.',
        )

        try {
          const { error: cleanupError } =
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

          if (cleanupError) {
            request.log.error(
              { err: cleanupError },
              'Não foi possível remover a conta de autenticação após falha no cadastro.',
            )
          }
        } catch (cleanupException) {
          request.log.error(
            { err: cleanupException },
            'Ocorreu uma exceção ao tentar remover a conta de autenticação após falha no cadastro.',
          )
        }

        return reply.status(500).send({
          message:
            'Não foi possível concluir o cadastro da empresa e do proprietário.',
        })
      }
    },
  )
}
