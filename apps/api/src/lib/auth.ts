
import type {
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import supabase from './supabase'
import prisma from './prisma'

class AuthenticationServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationServiceUnavailableError'
  }
}

export async function getAuthenticatedUser(request: FastifyRequest) {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length)

  if (!token) {
    return null
  }

  let data
  let error

  try {
    const result = await supabase.auth.getUser(token)
    data = result.data
    error = result.error
  } catch (exception) {
    request.log.error(
      { err: exception },
      'Erro ao validar o token no Supabase.',
    )

    throw new AuthenticationServiceUnavailableError(
      'Serviço de autenticação temporariamente indisponível.',
    )
  }

  if (error || !data.user) {
    return null
  }

  let user

  try {
    user = await prisma.user.findUnique({
      where: {
        supabaseUserId: data.user.id,
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
  } catch (exception) {
    request.log.error(
      { err: exception },
      'Erro ao buscar o usuário no banco de dados durante a autenticação.',
    )

    throw new AuthenticationServiceUnavailableError(
      'Serviço de autenticação temporariamente indisponível.',
    )
  }

  if (!user) {
    return null
  }

  return user
}

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedUser>>
>

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser: AuthenticatedUser | null
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  let user: AuthenticatedUser | null

  try {
    user = await getAuthenticatedUser(request)
  } catch (exception) {
    if (exception instanceof AuthenticationServiceUnavailableError) {
      return reply.status(503).send({
        message:
          'Serviço de autenticação temporariamente indisponível. Tente novamente.',
      })
    }

    throw exception
  }

  if (!user) {
    return reply.status(401).send({
      message: 'Não autenticado.',
    })
  }

  request.authenticatedUser = user
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.authenticatedUser

  if (!user) {
    return reply.status(401).send({
      message: 'Não autenticado.',
    })
  }

  if (user.role !== 'ADMIN') {
    return reply.status(403).send({
      message: 'Apenas administradores podem acessar este recurso.',
    })
  }
}

export async function requireOwner(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.authenticatedUser

  if (!user) {
    return reply.status(401).send({
      message: 'Não autenticado.',
    })
  }

  if (user.role !== 'OWNER') {
    return reply.status(403).send({
      message: 'Apenas proprietários podem acessar este recurso.',
    })
  }
}

export function getCompanyAccessError(user: AuthenticatedUser) {
  if (user.role === 'ADMIN') {
    return null
  }

  if (!user.companyId) {
    return {
      statusCode: 403,
      message: 'Usuário sem empresa vinculada.',
    }
  }

  if (!user.company) {
    return {
      statusCode: 403,
      message: 'Empresa não encontrada ou indisponível.',
    }
  }

  if (user.company.status !== 'ACTIVE') {
    return {
      statusCode: 403,
      message: 'A empresa está suspensa. Entre em contato com o suporte.',
    }
  }

  return null
}

export async function requireCompanyAccess(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.authenticatedUser

  if (!user) {
    return reply.status(401).send({
      message: 'Não autenticado.',
    })
  }

  const accessError = getCompanyAccessError(user)

  if (accessError) {
    return reply.status(accessError.statusCode).send({
      message: accessError.message,
    })
  }
}
