
import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import {
  authenticate,
  requireOwner,
  requireCompanyAccess,
} from '../lib/auth'
import supabaseAdmin from '../lib/supabase-admin'

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

export async function employeeRoutes(app: FastifyInstance) {
  app.post(
    '/employees',
    {
      preHandler: [
        authenticate,
        requireOwner,
        requireCompanyAccess,
      ],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              pattern: '\\S',
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 254,
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 128,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const owner = request.authenticatedUser!

      const body = request.body as {
        name: string
        email: string
        password: string
      }

      const name = body.name.trim()
      const email = body.email.trim().toLowerCase()

      if (!name || !email) {
        return reply.status(400).send({
          message: 'Informe o nome e o e-mail do funcionário.',
        })
      }

      if (!owner.companyId) {
        return reply.status(403).send({
          message: 'Proprietário sem empresa vinculada.',
        })
      }

      let authData
      let authError

      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            name,
          },
        })

        authData = result.data
        authError = result.error
      } catch (error) {
        request.log.error(
          { err: error },
          'Erro inesperado ao criar a conta de autenticação do funcionário.',
        )

        return reply.status(503).send({
          message:
            'Serviço de autenticação temporariamente indisponível. Tente novamente.',
        })
      }

      if (authError || !authData.user) {
        return reply.status(400).send({
          message:
            'Não foi possível criar a conta do funcionário. Verifique o e-mail informado.',
        })
      }

      try {
        const employee = await prisma.user.create({
          data: {
            supabaseUserId: authData.user.id,
            name,
            email,
            role: 'EMPLOYEE',
            companyId: owner.companyId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyId: true,
          },
        })

        return reply.status(201).send({
          employee,
        })
      } catch (error) {
        try {
          const { error: cleanupError } =
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

          if (cleanupError) {
            request.log.error(
              { err: cleanupError },
              'Não foi possível remover a conta de autenticação após falha no cadastro do funcionário.',
            )
          }
        } catch (cleanupException) {
          request.log.error(
            { err: cleanupException },
            'Ocorreu uma exceção ao tentar remover a conta de autenticação após falha no cadastro do funcionário.',
          )
        }

        if (isUniqueConstraintError(error)) {
          request.log.warn(
            { err: error },
            'O funcionário não foi cadastrado porque o e-mail já está em uso nesta empresa.',
          )

          return reply.status(409).send({
            message:
              'Não foi possível cadastrar o funcionário. Verifique se o e-mail já está em uso nesta empresa.',
          })
        }

        request.log.error(
          { err: error },
          'Não foi possível salvar o funcionário no banco de dados.',
        )

        return reply.status(503).send({
          message:
            'Não foi possível cadastrar o funcionário devido a uma indisponibilidade. Tente novamente.',
        })
      }
    },
  )
}
