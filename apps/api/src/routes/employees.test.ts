
import { afterEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
  authenticate: vi.fn(),
  requireOwner: vi.fn(),
  requireCompanyAccess: vi.fn(),
}))

vi.mock('../lib/supabase-admin', () => ({
  default: {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
}))

import prisma from '../lib/prisma'
import {
  getAuthenticatedUser,
  authenticate,
  requireOwner,
  requireCompanyAccess,
} from '../lib/auth'
import supabaseAdmin from '../lib/supabase-admin'
import { employeeRoutes } from './employees'

const validPayload = {
  name: 'Funcionário Teste',
  email: 'funcionario@example.com',
  password: 'SenhaTeste123!',
}

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
  name: 'Funcionário Existente',
  email: 'employee@example.com',
  role: 'EMPLOYEE' as const,
  companyId: 'empresa-owner',
  company: {
    status: 'ACTIVE' as const,
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

const supabaseUserId = 'supabase-employee-id'

function configureAuthentication(
  user:
    | typeof ownerUser
    | typeof employeeUser
    | typeof adminUser
    | null,
) {
  vi.mocked(getAuthenticatedUser).mockResolvedValue(user as never)

  vi.mocked(authenticate).mockImplementation(async (request, reply) => {
    const authenticatedUser = await getAuthenticatedUser(request)

    if (!authenticatedUser) {
      return reply.status(401).send({
        message: 'Não autenticado.',
      })
    }

    request.authenticatedUser = authenticatedUser
  })

  vi.mocked(requireOwner).mockImplementation(async (request, reply) => {
    const authenticatedUser = request.authenticatedUser

    if (!authenticatedUser) {
      return reply.status(401).send({
        message: 'Não autenticado.',
      })
    }

    if (authenticatedUser.role !== 'OWNER') {
      return reply.status(403).send({
        message: 'Apenas proprietários podem acessar este recurso.',
      })
    }
  })

  vi.mocked(requireCompanyAccess).mockImplementation(async (request, reply) => {
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
        message: 'A empresa está suspensa. Entre em contato com o suporte.',
      })
    }
  })
}

function mockSupabaseUserCreation() {
  vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValue({
    data: {
      user: {
        id: supabaseUserId,
      },
    },
    error: null,
  } as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>)
}

function mockEmployeeCreation() {
  vi.mocked(prisma.user.create).mockResolvedValue({
    id: 'employee-database-id',
    name: validPayload.name,
    email: validPayload.email,
    role: 'EMPLOYEE',
    companyId: ownerUser.companyId,
  } as never)
}

function mockSupabaseUserDeletion() {
  vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockResolvedValue({
    data: {
      user: null,
    },
    error: null,
  } as unknown as Awaited<
    ReturnType<typeof supabaseAdmin.auth.admin.deleteUser>
  >)
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

  await app.register(employeeRoutes)

  return app
}

describe('POST /employees', () => {
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
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({
          message: 'Não autenticado.',
        })
        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
        expect(prisma.user.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário é EMPLOYEE', async () => {
      configureAuthentication(employeeUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message: 'Apenas proprietários podem acessar este recurso.',
        })
        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
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
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve bloquear o OWNER quando sua empresa está suspensa', async () => {
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
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message: 'A empresa está suspensa. Entre em contato com o suporte.',
        })
        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('validação dos dados', () => {
    const invalidPayloads = [
      {
        description: 'sem nome',
        payload: {
          email: validPayload.email,
          password: validPayload.password,
        },
      },
      {
        description: 'sem e-mail',
        payload: {
          name: validPayload.name,
          password: validPayload.password,
        },
      },
      {
        description: 'sem senha',
        payload: {
          name: validPayload.name,
          email: validPayload.email,
        },
      },
      {
        description: 'com nome vazio',
        payload: {
          ...validPayload,
          name: '',
        },
      },
      {
        description: 'com nome contendo apenas espaços',
        payload: {
          ...validPayload,
          name: '   ',
        },
      },
      {
        description: 'com nome maior que 120 caracteres',
        payload: {
          ...validPayload,
          name: 'a'.repeat(121),
        },
      },
      {
        description: 'com e-mail inválido',
        payload: {
          ...validPayload,
          email: 'email-invalido',
        },
      },
      {
        description: 'com e-mail maior que 254 caracteres',
        payload: {
          ...validPayload,
          email: `${'a'.repeat(243)}@example.com`,
        },
      },
      {
        description: 'com senha menor que 8 caracteres',
        payload: {
          ...validPayload,
          password: '1234567',
        },
      },
      {
        description: 'com senha maior que 128 caracteres',
        payload: {
          ...validPayload,
          password: 'a'.repeat(129),
        },
      },
      {
        description: 'com propriedade companyId não permitida',
        payload: {
          ...validPayload,
          companyId: 'outra-empresa',
        },
      },
      {
        description: 'com propriedade role não permitida',
        payload: {
          ...validPayload,
          role: 'ADMIN',
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
            url: '/employees',
            payload,
          })

          expect(response.statusCode).toBe(400)
          expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
          expect(prisma.user.create).not.toHaveBeenCalled()
        } finally {
          await app.close()
        }
      },
    )
  })

  describe('cadastro bem-sucedido', () => {
    it('deve cadastrar o funcionário na empresa do OWNER com perfil EMPLOYEE', async () => {
      configureAuthentication(ownerUser)
      mockSupabaseUserCreation()
      mockEmployeeCreation()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)
        expect(response.json()).toEqual({
          employee: {
            id: 'employee-database-id',
            name: validPayload.name,
            email: validPayload.email,
            role: 'EMPLOYEE',
            companyId: ownerUser.companyId,
          },
        })

        expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
          email: validPayload.email,
          password: validPayload.password,
          email_confirm: true,
          user_metadata: {
            name: validPayload.name,
          },
        })

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: {
            supabaseUserId: supabaseUserId,
            name: validPayload.name,
            email: validPayload.email,
            role: 'EMPLOYEE',
            companyId: ownerUser.companyId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyId: true,
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve remover espaços do nome e converter o e-mail para minúsculas', async () => {
      configureAuthentication(ownerUser)
      mockSupabaseUserCreation()
      mockEmployeeCreation()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: {
            name: '  Maria Teste  ',
            email: 'MARIA@EXAMPLE.COM',
            password: validPayload.password,
          },
        })

        expect(response.statusCode).toBe(201)

        expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
          email: 'maria@example.com',
          password: validPayload.password,
          email_confirm: true,
          user_metadata: {
            name: 'Maria Teste',
          },
        })

        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Maria Teste',
              email: 'maria@example.com',
              role: 'EMPLOYEE',
              companyId: ownerUser.companyId,
            }),
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas no Supabase', () => {
    it('deve retornar 400 quando o Supabase falha ao criar o usuário', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValue({
        data: {
          user: null,
        },
        error: {
          message: 'Erro simulado',
        },
      } as unknown as Awaited<
        ReturnType<typeof supabaseAdmin.auth.admin.createUser>
      >)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({
          message:
            'Não foi possível criar a conta do funcionário. Verifique o e-mail informado.',
        })
        expect(prisma.user.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 400 quando o Supabase não retorna usuário nem erro', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValue({
        data: {
          user: null,
        },
        error: null,
      } as unknown as Awaited<
        ReturnType<typeof supabaseAdmin.auth.admin.createUser>
      >)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.user.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 503 quando o Supabase lança uma exceção ao criar o usuário', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(supabaseAdmin.auth.admin.createUser).mockRejectedValue(
        new Error('Falha de conexão com o Supabase'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Serviço de autenticação temporariamente indisponível. Tente novamente.',
        })

        expect(prisma.user.create).not.toHaveBeenCalled()
        expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas no banco de dados e limpeza', () => {
    it('deve retornar 503 e excluir a conta do Supabase quando o Prisma apresenta uma falha inesperada', async () => {
      configureAuthentication(ownerUser)
      mockSupabaseUserCreation()
      mockSupabaseUserDeletion()

      vi.mocked(prisma.user.create).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível cadastrar o funcionário devido a uma indisponibilidade. Tente novamente.',
        })

        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
          supabaseUserId,
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar 409 quando o Prisma identifica um e-mail duplicado', async () => {
      configureAuthentication(ownerUser)
      mockSupabaseUserCreation()
      mockSupabaseUserDeletion()

      vi.mocked(prisma.user.create).mockRejectedValue({
        code: 'P2002',
        meta: {
          target: ['companyId', 'email'],
        },
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(409)
        expect(response.json()).toEqual({
          message:
            'Não foi possível cadastrar o funcionário. Verifique se o e-mail já está em uso nesta empresa.',
        })

        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
          supabaseUserId,
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar 503 mesmo quando a exclusão no Supabase falha', async () => {
      configureAuthentication(ownerUser)
      mockSupabaseUserCreation()

      vi.mocked(prisma.user.create).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockResolvedValue({
        data: {
          user: null,
        },
        error: {
          message: 'Falha simulada ao excluir usuário',
        },
      } as unknown as Awaited<
        ReturnType<typeof supabaseAdmin.auth.admin.deleteUser>
      >)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
          supabaseUserId,
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar 503 mesmo quando a exclusão no Supabase lança uma exceção', async () => {
      configureAuthentication(ownerUser)
      mockSupabaseUserCreation()

      vi.mocked(prisma.user.create).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockRejectedValue(
        new Error('Falha inesperada na conexão com o Supabase'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/employees',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível cadastrar o funcionário devido a uma indisponibilidade. Tente novamente.',
        })

        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
          supabaseUserId,
        )
      } finally {
        await app.close()
      }
    })
  })
})
