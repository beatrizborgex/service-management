
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    company: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
  authenticate: vi.fn(),
  requireAdmin: vi.fn(),
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
  requireAdmin,
} from '../lib/auth'
import supabaseAdmin from '../lib/supabase-admin'
import { adminCompanyRoutes } from './admin-companies'

const validPayload = {
  companyName: 'Empresa Teste',
  ownerName: 'Proprietário Teste',
  ownerEmail: 'proprietario@example.com',
  ownerPassword: 'SenhaTeste123!',
}

const adminUser = {
  id: 'user-admin-teste',
  name: 'Admin Teste',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  companyId: null,
  company: null,
}

const ownerUser = {
  id: 'user-owner-teste',
  name: 'Proprietário Teste',
  email: 'owner@example.com',
  role: 'OWNER' as const,
  companyId: 'empresa-teste',
  company: {
    status: 'ACTIVE' as const,
  },
}

const supabaseUserId = 'supabase-user-teste'

function configureAuthentication(user: typeof adminUser | typeof ownerUser | null) {
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

  vi.mocked(requireAdmin).mockImplementation(async (request, reply) => {
    const authenticatedUser = request.authenticatedUser

    if (!authenticatedUser) {
      return reply.status(401).send({
        message: 'Não autenticado.',
      })
    }

    if (authenticatedUser.role !== 'ADMIN') {
      return reply.status(403).send({
        message: 'Apenas administradores podem acessar este recurso.',
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

function mockSuccessfulTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
    const transaction = {
      company: {
        create: vi.fn().mockResolvedValue({
          id: 'empresa-nova',
          name: validPayload.companyName,
        }),
      },
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'usuario-novo',
          name: validPayload.ownerName,
          email: validPayload.ownerEmail,
          role: 'OWNER',
          companyId: 'empresa-nova',
        }),
      },
    }

    return callback(transaction as never)
  })
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

  await app.register(adminCompanyRoutes)

  return app
}

describe('POST /admin/companies', () => {
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
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({
          message: 'Não autenticado.',
        })
        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário não é ADMIN', async () => {
      configureAuthentication(ownerUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message: 'Apenas administradores podem acessar este recurso.',
        })
        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('validação dos dados', () => {
    const invalidPayloads = [
      {
        description: 'sem companyName',
        payload: {
          ownerName: validPayload.ownerName,
          ownerEmail: validPayload.ownerEmail,
          ownerPassword: validPayload.ownerPassword,
        },
      },
      {
        description: 'sem ownerName',
        payload: {
          companyName: validPayload.companyName,
          ownerEmail: validPayload.ownerEmail,
          ownerPassword: validPayload.ownerPassword,
        },
      },
      {
        description: 'sem ownerEmail',
        payload: {
          companyName: validPayload.companyName,
          ownerName: validPayload.ownerName,
          ownerPassword: validPayload.ownerPassword,
        },
      },
      {
        description: 'sem ownerPassword',
        payload: {
          companyName: validPayload.companyName,
          ownerName: validPayload.ownerName,
          ownerEmail: validPayload.ownerEmail,
        },
      },
      {
        description: 'com e-mail inválido',
        payload: {
          ...validPayload,
          ownerEmail: 'email-invalido',
        },
      },
      {
        description: 'com senha menor que 8 caracteres',
        payload: {
          ...validPayload,
          ownerPassword: '1234567',
        },
      },
      {
        description: 'com senha maior que 128 caracteres',
        payload: {
          ...validPayload,
          ownerPassword: 'a'.repeat(129),
        },
      },
      {
        description: 'com nome da empresa vazio',
        payload: {
          ...validPayload,
          companyName: '',
        },
      },
      {
        description: 'com nome da empresa contendo apenas espaços',
        payload: {
          ...validPayload,
          companyName: '   ',
        },
      },
      {
        description: 'com nome do proprietário vazio',
        payload: {
          ...validPayload,
          ownerName: '',
        },
      },
      {
        description: 'com nome do proprietário contendo apenas espaços',
        payload: {
          ...validPayload,
          ownerName: '   ',
        },
      },
      {
        description: 'com nome da empresa maior que 120 caracteres',
        payload: {
          ...validPayload,
          companyName: 'a'.repeat(121),
        },
      },
      {
        description: 'com nome do proprietário maior que 120 caracteres',
        payload: {
          ...validPayload,
          ownerName: 'a'.repeat(121),
        },
      },
      {
        description: 'com e-mail maior que 254 caracteres',
        payload: {
          ...validPayload,
          ownerEmail: `${'a'.repeat(243)}@example.com`,
        },
      },
      {
        description: 'com propriedade não permitida',
        payload: {
          ...validPayload,
          role: 'ADMIN',
        },
      },
      {
        description: 'com tipo incorreto para companyName',
        payload: {
          ...validPayload,
          companyName: 123,
        },
      },
    ]

    it.each(invalidPayloads)(
      'deve rejeitar a requisição $description',
      async ({ payload }) => {
        configureAuthentication(adminUser)

        const app = await createApp()

        try {
          const response = await app.inject({
            method: 'POST',
            url: '/admin/companies',
            payload,
          })

          expect(response.statusCode).toBe(400)
          expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
          expect(prisma.$transaction).not.toHaveBeenCalled()
        } finally {
          await app.close()
        }
      },
    )
  })

  describe('cadastro bem-sucedido', () => {
    it('deve cadastrar a empresa e o proprietário quando o usuário é ADMIN', async () => {
      configureAuthentication(adminUser)
      mockSupabaseUserCreation()
      mockSuccessfulTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: {
            ...validPayload,
            companyName: ' Empresa Teste ',
            ownerName: ' Proprietário Teste ',
          },
        })

        expect(response.statusCode).toBe(201)
        expect(response.json()).toEqual({
          company: {
            id: 'empresa-nova',
            name: 'Empresa Teste',
          },
          owner: {
            id: 'usuario-novo',
            name: 'Proprietário Teste',
            email: 'proprietario@example.com',
            role: 'OWNER',
            companyId: 'empresa-nova',
          },
        })

        expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
          email: 'proprietario@example.com',
          password: 'SenhaTeste123!',
          email_confirm: true,
          user_metadata: {
            name: 'Proprietário Teste',
          },
        })

        expect(prisma.$transaction).toHaveBeenCalledOnce()
      } finally {
        await app.close()
      }
    })

    it('deve remover espaços dos nomes e converter o e-mail para minúsculas', async () => {
      configureAuthentication(adminUser)
      mockSupabaseUserCreation()
      mockSuccessfulTransaction()

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: {
            companyName: '  Minha Empresa  ',
            ownerName: '  Maria Teste  ',
            ownerEmail: 'MARIA@EXAMPLE.COM',
            ownerPassword: validPayload.ownerPassword,
          },
        })

        expect(response.statusCode).toBe(201)

        expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
          email: 'maria@example.com',
          password: validPayload.ownerPassword,
          email_confirm: true,
          user_metadata: {
            name: 'Maria Teste',
          },
        })
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas no Supabase', () => {
    beforeEach(() => {
      configureAuthentication(adminUser)
    })

    it('deve retornar 400 quando o Supabase retorna um erro ao criar o usuário', async () => {
      vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValue({
        data: {
          user: null,
        },
        error: {
          message: 'Erro simulado ao criar usuário',
        },
      } as unknown as Awaited<
        ReturnType<typeof supabaseAdmin.auth.admin.createUser>
      >)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({
          message:
            'Não foi possível criar a conta do proprietário. Verifique o e-mail informado.',
        })
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 400 quando o Supabase não retorna usuário nem erro', async () => {
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
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 503 quando o Supabase lança uma exceção ao criar o usuário', async () => {
      vi.mocked(supabaseAdmin.auth.admin.createUser).mockRejectedValue(
        new Error('Falha de conexão com o Supabase'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Serviço de autenticação temporariamente indisponível. Tente novamente.',
        })
        expect(prisma.$transaction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas na transação e limpeza', () => {
    beforeEach(() => {
      configureAuthentication(adminUser)
      mockSupabaseUserCreation()
    })

    it('deve excluir a conta do Supabase e retornar 500 quando a transação falha', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Erro simulado na transação'),
      )

      vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockResolvedValue({
        data: {
          user: null,
        },
        error: null,
      } as unknown as Awaited<
        ReturnType<typeof supabaseAdmin.auth.admin.deleteUser>
      >)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(500)
        expect(response.json()).toEqual({
          message:
            'Não foi possível concluir o cadastro da empresa e do proprietário.',
        })

        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
          supabaseUserId,
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar 500 mesmo quando a exclusão no Supabase também falha', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Erro simulado na transação'),
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
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(500)
        expect(response.json()).toEqual({
          message:
            'Não foi possível concluir o cadastro da empresa e do proprietário.',
        })

        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
          supabaseUserId,
        )
      } finally {
        await app.close()
      }
    })

    it('deve retornar 500 mesmo quando a exclusão no Supabase lança uma exceção', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Erro simulado na transação'),
      )

      vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockRejectedValue(
        new Error('Falha de conexão ao excluir usuário'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/admin/companies',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(500)
        expect(response.json()).toEqual({
          message:
            'Não foi possível concluir o cadastro da empresa e do proprietário.',
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

describe('PATCH /admin/companies/:companyId/status', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar 401 quando o usuário não está autenticado', async () => {
    configureAuthentication(null)

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-1/status',
        payload: { status: 'SUSPENDED' },
      })

      expect(response.statusCode).toBe(401)
      expect(prisma.company.updateMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('deve retornar 403 quando o usuário não é ADMIN', async () => {
    configureAuthentication(ownerUser)

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-1/status',
        payload: { status: 'SUSPENDED' },
      })

      expect(response.statusCode).toBe(403)
      expect(prisma.company.updateMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('deve suspender uma empresa quando o usuário é ADMIN', async () => {
    configureAuthentication(adminUser)
    vi.mocked(prisma.company.updateMany).mockResolvedValue({ count: 1 })

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-1/status',
        payload: { status: 'SUSPENDED' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        companyId: 'empresa-1',
        status: 'SUSPENDED',
      })
      expect(prisma.company.updateMany).toHaveBeenCalledWith({
        where: { id: 'empresa-1' },
        data: { status: 'SUSPENDED' },
      })
    } finally {
      await app.close()
    }
  })

  it('deve permitir reativar uma empresa', async () => {
    configureAuthentication(adminUser)
    vi.mocked(prisma.company.updateMany).mockResolvedValue({ count: 1 })

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-1/status',
        payload: { status: 'ACTIVE' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        companyId: 'empresa-1',
        status: 'ACTIVE',
      })
      expect(prisma.company.updateMany).toHaveBeenCalledWith({
        where: { id: 'empresa-1' },
        data: { status: 'ACTIVE' },
      })
    } finally {
      await app.close()
    }
  })

  it('deve retornar 404 quando a empresa não existe', async () => {
    configureAuthentication(adminUser)
    vi.mocked(prisma.company.updateMany).mockResolvedValue({ count: 0 })

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-inexistente/status',
        payload: { status: 'SUSPENDED' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        message: 'Empresa não encontrada.',
      })
    } finally {
      await app.close()
    }
  })

  it('deve retornar 503 quando o banco lança uma exceção ao atualizar o status', async () => {
    configureAuthentication(adminUser)

    vi.mocked(prisma.company.updateMany).mockRejectedValue(
      new Error('Falha de conexão com o banco de dados'),
    )

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-1/status',
        payload: { status: 'SUSPENDED' },
      })

      expect(response.statusCode).toBe(503)
      expect(response.json()).toEqual({
        message:
          'Não foi possível atualizar o status da empresa. Tente novamente.',
      })
    } finally {
      await app.close()
    }
  })

  it('deve rejeitar um status inválido', async () => {
    configureAuthentication(adminUser)

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/companies/empresa-1/status',
        payload: { status: 'INVALIDO' },
      })

      expect(response.statusCode).toBe(400)
      expect(prisma.company.updateMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
