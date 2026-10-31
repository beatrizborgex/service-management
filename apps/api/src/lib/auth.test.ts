import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('./supabase', () => ({
  default: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

vi.mock('./prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import supabase from './supabase'
import prisma from './prisma'
import {
  authenticate,
  getAuthenticatedUser,
  getCompanyAccessError,
  requireAdmin,
  requireCompanyAccess,
} from './auth'

type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedUser>>
>

const adminUser = {
  id: 'admin-1',
  name: 'Administrador',
  email: 'admin@email.com',
  role: 'ADMIN',
  companyId: null,
  company: null,
} as AuthenticatedUser

const ownerWithoutCompany = {
  id: 'owner-1',
  name: 'Proprietário',
  email: 'owner@email.com',
  role: 'OWNER',
  companyId: null,
  company: null,
} as AuthenticatedUser

const suspendedOwner = {
  id: 'owner-2',
  name: 'Proprietário',
  email: 'owner@email.com',
  role: 'OWNER',
  companyId: 'empresa-1',
  company: {
    status: 'SUSPENDED',
  },
} as AuthenticatedUser

const ownerWithMissingCompany = {
  id: 'owner-4',
  name: 'Proprietário',
  email: 'owner@email.com',
  role: 'OWNER',
  companyId: 'empresa-inexistente',
  company: null,
} as AuthenticatedUser

const activeOwner = {
  id: 'owner-3',
  name: 'Proprietário',
  email: 'owner@email.com',
  role: 'OWNER',
  companyId: 'empresa-2',
  company: {
    status: 'ACTIVE',
  },
} as AuthenticatedUser

async function createApp(
  preHandler: typeof authenticate[],
) {
  const app = Fastify()

  app.decorateRequest('authenticatedUser', null)

  app.get(
    '/protected',
    {
      preHandler,
    },
    async (request) => {
      return {
        message: 'Acesso permitido.',
        userId: request.authenticatedUser?.id,
      }
    },
  )

  return app
}

function mockAuthenticatedUser(user: AuthenticatedUser) {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: {
      user: {
        id: `supabase-${user.id}`,
      },
    },
    error: null,
  } as never)

  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getCompanyAccessError', () => {
  it('deve permitir acesso ao ADMIN, mesmo sem empresa vinculada', () => {
    const result = getCompanyAccessError(adminUser)

    expect(result).toBeNull()
  })

  it('deve bloquear usuário sem empresa vinculada', () => {
    const result = getCompanyAccessError(ownerWithoutCompany)

    expect(result).toEqual({
      statusCode: 403,
      message: 'Usuário sem empresa vinculada.',
    })
  })

  it('deve bloquear usuário de empresa suspensa', () => {
    const result = getCompanyAccessError(suspendedOwner)

    expect(result).toEqual({
      statusCode: 403,
      message: 'A empresa está suspensa. Entre em contato com o suporte.',
    })
  })

  it('deve permitir acesso ao usuário de empresa ativa', () => {
    const result = getCompanyAccessError(activeOwner)

    expect(result).toBeNull()
  })

  it('deve bloquear usuário cuja empresa não foi encontrada', () => {
    const result = getCompanyAccessError(ownerWithMissingCompany)

    expect(result).toEqual({
      statusCode: 403,
      message: 'Empresa não encontrada ou indisponível.',
    })
  })
})

describe('authenticate', () => {
  it('deve retornar 401 quando não existe token Bearer', async () => {
    const app = await createApp([authenticate])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        message: 'Não autenticado.',
      })
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('deve retornar 401 quando o token é inválido', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: null,
      },
      error: {
        message: 'Invalid token',
      },
    } as never)

    const app = await createApp([authenticate])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-invalido',
        },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        message: 'Não autenticado.',
      })
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('deve retornar erro de serviço quando o Supabase lança uma exceção', async () => {
    vi.mocked(supabase.auth.getUser).mockRejectedValue(
      new Error('Falha de conexão com o Supabase'),
    )

    const app = await createApp([authenticate])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-valido',
        },
      })

      expect(response.statusCode).toBe(503)
    } finally {
      await app.close()
    }
  })

  it('deve retornar 401 quando não existe usuário cadastrado no banco', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: 'supabase-user-1',
        },
      },
      error: null,
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const app = await createApp([authenticate])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-valido',
        },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        message: 'Não autenticado.',
      })
    } finally {
      await app.close()
    }
  })

  it('deve autenticar o usuário quando o token e o cadastro são válidos', async () => {
    mockAuthenticatedUser(activeOwner)

    const app = await createApp([authenticate])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-valido',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        message: 'Acesso permitido.',
        userId: activeOwner.id,
      })

      expect(supabase.auth.getUser).toHaveBeenCalledWith('token-valido')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          supabaseUserId: `supabase-${activeOwner.id}`,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          companyId: true,
          company: {
            select: {
              status: true,
            },
          },
        },
      })
    } finally {
      await app.close()
    }
  })
})

describe('requireAdmin', () => {
  it('deve permitir acesso ao ADMIN', async () => {
    mockAuthenticatedUser(adminUser)

    const app = await createApp([authenticate, requireAdmin])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-admin',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().userId).toBe(adminUser.id)
    } finally {
      await app.close()
    }
  })

  it('deve retornar 403 para usuário que não é ADMIN', async () => {
    mockAuthenticatedUser(activeOwner)

    const app = await createApp([authenticate, requireAdmin])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-owner',
        },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toEqual({
        message: 'Apenas administradores podem acessar este recurso.',
      })
    } finally {
      await app.close()
    }
  })

  it('deve retornar 401 quando requireAdmin é executado sem usuário autenticado', async () => {
    const app = await createApp([requireAdmin])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        message: 'Não autenticado.',
      })
    } finally {
      await app.close()
    }
  })
})

describe('requireCompanyAccess', () => {
  it('deve permitir acesso ao usuário de empresa ativa', async () => {
    mockAuthenticatedUser(activeOwner)

    const app = await createApp([authenticate, requireCompanyAccess])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-owner',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().userId).toBe(activeOwner.id)
    } finally {
      await app.close()
    }
  })

  it('deve retornar 403 quando a empresa do usuário está suspensa', async () => {
    mockAuthenticatedUser(suspendedOwner)

    const app = await createApp([authenticate, requireCompanyAccess])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-owner',
        },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toEqual({
        message:
          'A empresa está suspensa. Entre em contato com o suporte.',
      })
    } finally {
      await app.close()
    }
  })

  it('deve retornar 403 quando o usuário não possui empresa vinculada', async () => {
    mockAuthenticatedUser(ownerWithoutCompany)

    const app = await createApp([authenticate, requireCompanyAccess])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-owner',
        },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toEqual({
        message: 'Usuário sem empresa vinculada.',
      })
    } finally {
      await app.close()
    }
  })

  it('deve permitir acesso ao ADMIN mesmo sem empresa vinculada', async () => {
    mockAuthenticatedUser(adminUser)

    const app = await createApp([authenticate, requireCompanyAccess])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer token-admin',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().userId).toBe(adminUser.id)
    } finally {
      await app.close()
    }
  })

  it('deve retornar 401 quando requireCompanyAccess é executado sem usuário autenticado', async () => {
    const app = await createApp([requireCompanyAccess])

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        message: 'Não autenticado.',
      })
    } finally {
      await app.close()
    }
  })
})