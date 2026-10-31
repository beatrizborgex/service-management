import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import prisma from '../src/lib/prisma'

async function main() {
  const terminal = createInterface({
    input: stdin,
    output: stdout,
  })

  try {
    const supabaseUserId = (
      await terminal.question('UID do usuário no Supabase: ')
    ).trim()

    const name = (
      await terminal.question('Nome do administrador: ')
    ).trim()

    const email = (
      await terminal.question('E-mail da conta administrativa: ')
    ).trim().toLowerCase()

    if (!supabaseUserId || !name || !email) {
      throw new Error('Todos os campos são obrigatórios.')
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        supabaseUserId,
      },
    })

    if (existingUser) {
      throw new Error(
        'Já existe um usuário vinculado a esse UID. Nenhuma alteração foi realizada.',
      )
    }

    const admin = await prisma.user.create({
      data: {
        supabaseUserId,
        name,
        email,
        role: 'ADMIN',
        companyId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    })

    console.log('\nAdministrador cadastrado com sucesso!')
    console.log(admin)
  } finally {
    terminal.close()
  }
}

main()
  .catch((error) => {
    console.error('\nNão foi possível cadastrar o administrador:')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
