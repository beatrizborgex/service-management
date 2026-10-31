
import { afterEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../lib/prisma', () => ({
  default: {
    company: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('../lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
  authenticate: vi.fn(),
  requireAdmin: vi.fn(),
  requireCompanyAccess: vi.fn(),
  getCompanyAccessError: vi.fn(),
}))

import prisma from '../lib/prisma'
import {
  getAuthenticatedUser,
  authenticate,
  requireAdmin,
  requireCompanyAccess,
  getCompanyAccessError,
} from '../lib/auth'
import { companyRoutes } from './companies'

const adminUser = {
  id: 'admin-teste',
  name: 'Administrador',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  companyId: null,
  company: null,
}

const ownerUser = {
  id: 'proprietario-teste',
  name: 'Proprietario',
  email: 'proprietario@example.com',
  role: 'OWNER' as const,
  companyId: 'empresa-1',
  company: {
    status: 'ACTIVE' as const,
  },
}

const suspendedOwnerUser = {
  ...ownerUser,
  company: {
    status: 'SUSPENDED' as const,
  },
}

const companyOne = {
  id: 'empresa-1',
  name: 'Noturna Celulares',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
}

const companyTwo = {
  id: 'empresa-2',
  name: 'Outra Empresa',
  createdAt: new Date('2026-01-02T10:00:00.000Z'),
}

type TestUser =
  | typeof adminUser
  | typeof ownerUser
  | typeof suspendedOwnerUser
  | {
      id: string
      name: string
      email: string
      role: 'OWNER'
      companyId: null
      company: {
        status: 'ACTIVE'
      }
    }
  | null

function configureAuthentication(user: TestUser) {
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

  vi.mocked(requireCompanyAccess).mockImplementation(
    async (request, reply) => {
      const authenticatedUser = request.authenticatedUser

      if (!authenticatedUser) {
        return reply.status(401).send({
          message: 'Não autenticado.',
        })
      }

      const accessError = getCompanyAccessError(authenticatedUser)

      if (accessError) {
        return reply.status(accessError.statusCode).send({
          message: accessError.message,
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

  await app.register(companyRoutes)

  return app
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Rotas de empresas', () => {
  describe('GET /companies/count', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies/count',
        })

        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({
          message: 'Não autenticado.',
        })
        expect(prisma.company.count).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário não é ADMIN', async () => {
      configureAuthentication(ownerUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies/count',
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message: 'Apenas administradores podem acessar este recurso.',
        })
        expect(prisma.company.count).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar a quantidade de empresas para ADMIN', async () => {
      configureAuthentication(adminUser)
      vi.mocked(prisma.company.count).mockResolvedValue(2)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies/count',
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ total: 2 })
        expect(prisma.company.count).toHaveBeenCalledOnce()
      } finally {
        await app.close()
      }
    })
  })

  describe('GET /companies', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies',
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.company.findMany).not.toHaveBeenCalled()
        expect(getCompanyAccessError).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar todas as empresas para ADMIN', async () => {
      configureAuthentication(adminUser)
      vi.mocked(getCompanyAccessError).mockReturnValue(null)
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        companyTwo,
        companyOne,
      ] as never)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies',
        })

        expect(response.statusCode).toBe(200)
        expect(response.json().companies).toHaveLength(2)
        expect(getCompanyAccessError).toHaveBeenCalledWith(adminUser)

        expect(prisma.company.findMany).toHaveBeenCalledWith({
          where: {},
          orderBy: {
            createdAt: 'desc',
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve retornar apenas a empresa vinculada ao usuário comum', async () => {
      configureAuthentication(ownerUser)
      vi.mocked(getCompanyAccessError).mockReturnValue(null)
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        companyOne,
      ] as never)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies',
        })

        expect(response.statusCode).toBe(200)
        expect(response.json().companies).toHaveLength(1)
        expect(response.json().companies[0].id).toBe('empresa-1')
        expect(getCompanyAccessError).toHaveBeenCalledWith(ownerUser)

        expect(prisma.company.findMany).toHaveBeenCalledWith({
          where: {
            id: 'empresa-1',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando a empresa do usuário está suspensa', async () => {
      configureAuthentication(suspendedOwnerUser)
      vi.mocked(getCompanyAccessError).mockReturnValue({
        statusCode: 403,
        message:
          'A empresa está suspensa. Entre em contato com o suporte.',
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies',
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message:
            'A empresa está suspensa. Entre em contato com o suporte.',
        })
        expect(prisma.company.findMany).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve retornar 403 quando o usuário não tem empresa vinculada', async () => {
      const ownerWithoutCompany = {
        ...ownerUser,
        companyId: null,
      }

      configureAuthentication(ownerWithoutCompany)
      vi.mocked(getCompanyAccessError).mockReturnValue({
        statusCode: 403,
        message: 'Usuário sem empresa vinculada.',
      })

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/companies',
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message: 'Usuário sem empresa vinculada.',
        })
        expect(prisma.company.findMany).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })

  describe('POST /companies', () => {
    it('deve retornar 401 quando o usuário não está autenticado', async () => {
      configureAuthentication(null)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/companies',
          payload: {
            name: 'Nova Empresa',
          },
        })

        expect(response.statusCode).toBe(401)
        expect(prisma.company.create).not.toHaveBeenCalled()
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
          url: '/companies',
          payload: {
            name: 'Nova Empresa',
          },
        })

        expect(response.statusCode).toBe(403)
        expect(response.json()).toEqual({
          message: 'Apenas administradores podem acessar este recurso.',
        })
        expect(prisma.company.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('deve cadastrar uma empresa quando o usuário é ADMIN', async () => {
      configureAuthentication(adminUser)
      vi.mocked(prisma.company.create).mockResolvedValue(
        companyOne as never,
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/companies',
          payload: {
            name: 'Noturna Celulares',
          },
        })

        expect(response.statusCode).toBe(201)
        expect(response.json().name).toBe('Noturna Celulares')
        expect(prisma.company.create).toHaveBeenCalledWith({
          data: {
            name: 'Noturna Celulares',
          },
        })
      } finally {
        await app.close()
      }
    })

    it('deve remover espaços no início e no fim do nome', async () => {
      configureAuthentication(adminUser)
      vi.mocked(prisma.company.create).mockResolvedValue(
        companyOne as never,
      )

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/companies',
          payload: {
            name: '  Noturna Celulares  ',
          },
        })

        expect(response.statusCode).toBe(201)
        expect(prisma.company.create).toHaveBeenCalledWith({
          data: {
            name: 'Noturna Celulares',
          },
        })
      } finally {
        await app.close()
      }
    })

    it.each([
      {
        description: 'sem nome',
        payload: {},
      },
      {
        description: 'nome vazio',
        payload: { name: '' },
      },
      {
        description: 'nome contendo apenas espaços',
        payload: { name: '   ' },
      },
      {
        description: 'nome maior que 120 caracteres',
        payload: { name: 'a'.repeat(121) },
      },
      {
        description: 'propriedade não permitida',
        payload: { name: 'Nova Empresa', extra: true },
      },
      {
        description: 'tipo incorreto para name',
        payload: { name: 123 },
      },
    ])('deve rejeitar requisição com $description', async ({ payload }) => {
      configureAuthentication(adminUser)

      const app = await createApp()

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/companies',
          payload,
        })

        expect(response.statusCode).toBe(400)
        expect(prisma.company.create).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })
})
