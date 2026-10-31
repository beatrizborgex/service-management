
import { afterEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../lib/prisma', () => ({
  default: {
    client: {
      create: vi.fn(),
      findMany: vi.fn(),
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
import { clientRoutes } from './clients'

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
  name: 'Maria da Silva',
  phone: '67999999999',
}

const createdClient = {
  id: 'client-1',
  name: validPayload.name,
  phone: validPayload.phone,
  companyId: ownerUser.companyId,
  createdAt: new Date('2026-10-31T10:00:00.000Z'),
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

  await app.register(clientRoutes)

  return app
}

describe('POST /clients', () => {
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
          url: '/clients',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.client.create).not.toHaveBeenCalled()
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
          url: '/clients',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(prisma.client.create).not.toHaveBeenCalled()
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
          url: '/clients',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message:
            'A empresa está suspensa. Entre em contato com o suporte.',
        })
        expect(prisma.client.create).not.toHaveBeenCalled()
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
          phone: validPayload.phone,
        },
      },
      {
        description: 'sem telefone',
        payload: {
          name: validPayload.name,
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
        description: 'com telefone vazio',
        payload: {
          ...validPayload,
          phone: '',
        },
      },
      {
        description: 'com telefone contendo apenas espaços',
        payload: {
          ...validPayload,
          phone: '   ',
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
        description: 'com telefone maior que 30 caracteres',
        payload: {
          ...validPayload,
          phone: '1'.repeat(31),
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
            url: '/clients',
            payload,
          })

          expect(response.statusCode).toBe(400)
          expect(prisma.client.create).not.toHaveBeenCalled()
        } finally {
          await app.close()
        }
      },
    )
  })

  describe('cadastro bem-sucedido', () => {
    it('deve cadastrar um cliente na empresa do OWNER', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.client.create).mockResolvedValue(
        createdClient as never,
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/clients',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)
        expect(response.json()).toEqual({
          client: {
            ...createdClient,
            createdAt: createdClient.createdAt.toISOString(),
          },
        })

        expect(prisma.client.create).toHaveBeenCalledWith({
          data: {
            name: validPayload.name,
            phone: validPayload.phone,
            companyId: ownerUser.companyId,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            companyId: true,
            createdAt: true,
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve permitir que EMPLOYEE cadastre clientes na própria empresa', async () => {
      configureAuthentication(employeeUser)

      vi.mocked(prisma.client.create).mockResolvedValue(
        {
          ...createdClient,
          companyId: employeeUser.companyId,
        } as never,
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/clients',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(201)
        expect(prisma.client.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              name: validPayload.name,
              phone: validPayload.phone,
              companyId: employeeUser.companyId,
            },
          }),
        )
      } finally {
        await app.close()
      }
    })

    it('deve remover espaços extras do nome e telefone', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.client.create).mockResolvedValue(
        createdClient as never,
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/clients',
          payload: {
            name: '  Maria da Silva  ',
            phone: '  67999999999  ',
          },
        })

        expect(response.statusCode).toBe(201)

        expect(prisma.client.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              name: 'Maria da Silva',
              phone: '67999999999',
              companyId: ownerUser.companyId,
            },
          }),
        )
      } finally {
        await app.close()
      }
    })
  })

  describe('falhas no banco de dados', () => {
    it('deve retornar 503 quando o banco apresenta uma falha', async () => {
      configureAuthentication(ownerUser)

      vi.mocked(prisma.client.create).mockRejectedValue(
        new Error('Falha de conexão com o banco'),
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/clients',
          payload: validPayload,
        })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
          message:
            'Não foi possível cadastrar o cliente devido a uma indisponibilidade. Tente novamente.',
        })
      } finally {
        await app.close()
      }
    })
  })
})

describe('GET /clients', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar 401 quando o usuário não está autenticado', async () => {
    configureAuthentication(null)

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/clients',
      })

      expect(response.statusCode).toBe(401)
      expect(prisma.client.findMany).not.toHaveBeenCalled()
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
        url: '/clients',
      })

      expect(response.statusCode).toBe(403)
      expect(prisma.client.findMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('deve listar somente os clientes da empresa do usuário', async () => {
    configureAuthentication(ownerUser)

    vi.mocked(prisma.client.findMany).mockResolvedValue(
      [createdClient] as never,
    )

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/clients',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        clients: [
          {
            ...createdClient,
            createdAt: createdClient.createdAt.toISOString(),
          },
        ],
      })

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: {
          companyId: ownerUser.companyId,
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
    } finally {
      await app.close()
    }
  })

  it('deve permitir que EMPLOYEE consulte os clientes da própria empresa', async () => {
    configureAuthentication(employeeUser)

    vi.mocked(prisma.client.findMany).mockResolvedValue(
      [createdClient] as never,
    )

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/clients',
      })

      expect(response.statusCode).toBe(200)
      expect(prisma.client.findMany).toHaveBeenCalledWith(
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

  it('deve retornar uma lista vazia quando a empresa não possui clientes', async () => {
    configureAuthentication(ownerUser)

    vi.mocked(prisma.client.findMany).mockResolvedValue([])

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/clients',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        clients: [],
      })
    } finally {
      await app.close()
    }
  })

  it('deve retornar 503 quando o banco apresenta uma falha', async () => {
    configureAuthentication(ownerUser)

    vi.mocked(prisma.client.findMany).mockRejectedValue(
      new Error('Falha de conexão com o banco'),
    )

    const app = await createApp()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/clients',
      })

      expect(response.statusCode).toBe(503)
      expect(response.json()).toEqual({
        message:
          'Não foi possível consultar os clientes devido a uma indisponibilidade. Tente novamente.',
      })
    } finally {
      await app.close()
    }
  })
})
