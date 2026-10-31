
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { companyRoutes } from './routes/companies'
import { adminCompanyRoutes } from './routes/admin-companies'
import { clientRoutes } from './routes/clients'
import { employeeRoutes } from './routes/employees'
import { serviceOrderRoutes } from './routes/service-orders'
import { authenticate } from './lib/auth'
import prisma from './lib/prisma'

function getServerConfig() {
  const port = Number(process.env.PORT ?? 3333)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('A variável PORT deve conter uma porta válida.')
  }

  return {
    port,
    host: process.env.HOST ?? '127.0.0.1',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
      },
    },
  })

  app.decorateRequest('authenticatedUser', null)

  await app.register(cors, {
    origin: getServerConfig().corsOrigin,
  })

  await app.register(companyRoutes)
  await app.register(adminCompanyRoutes)
  await app.register(employeeRoutes)
  await app.register(clientRoutes)
  await app.register(serviceOrderRoutes)

  app.get(
    '/me',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const user = request.authenticatedUser!

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyStatus: user.company?.status ?? null,
      }
    },
  )

  app.get('/health', async () => {
    return {
      status: 'ok',
      message: 'API da Noturna Celulares funcionando!',
    }
  })

  return app
}

async function startServer() {
  const app = await buildApp()
  const config = getServerConfig()

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    })

    app.log.info(
      `API iniciada em http://${config.host}:${config.port}`,
    )
  } catch (error) {
    app.log.error(error)
    await app.close()
    await prisma.$disconnect()
    process.exitCode = 1
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Recebido ${signal}. Encerrando a aplicação...`)

    try {
      await app.close()
      await prisma.$disconnect()

      app.log.info('Aplicação encerrada com sucesso.')
      process.exit(0)
    } catch (error) {
      app.log.error(error, 'Erro ao encerrar a aplicação.')
      process.exit(1)
    }
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT')
  })

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

startServer().catch((error) => {
  console.error('Não foi possível iniciar a API:', error)
  process.exitCode = 1
})
