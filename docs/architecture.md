# Arquitetura do Sistema

## 1. Visão geral

O Service Management será uma aplicação web com arquitetura cliente-servidor, organizada em frontend, backend e banco de dados.

A arquitetura será preparada para atender múltiplas empresas, mantendo os dados e as permissões de cada empresa isolados.

## 2. Tecnologias

### Frontend

- Vue 3 para construção da interface.
- TypeScript para tipagem estática.
- Tailwind CSS para estilização.
- Consumo da API HTTP do backend.

### Backend

- Node.js como ambiente de execução.
- TypeScript para desenvolvimento.
- Fastify como framework HTTP.
- Prisma como ORM e ferramenta de migrações.
- Validação dos dados recebidos pela API.
- Autenticação, autorização e regras de negócio.

### Banco de dados

- PostgreSQL para armazenamento persistente.
- Prisma para consultas e gerenciamento do esquema.
- Migrações versionadas para acompanhar alterações no banco.

### Autenticação

- Supabase Auth para autenticação e gerenciamento de sessões.
- Backend responsável por validar os tokens recebidos.
- Autorização aplicada no backend em cada operação protegida.

### Arquivos

- Armazenamento privado para PDFs, assinaturas digitalizadas e anexos.
- Acesso aos arquivos controlado pelo backend.
- Preservação das versões dos documentos emitidos.

## 3. Comunicação entre as partes

O frontend enviará requisições HTTP para a API do backend.

O backend validará a requisição, verificará a identidade e as permissões do usuário, aplicará as regras de negócio e acessará o banco de dados quando necessário.

O frontend não acessará diretamente o banco de dados.

Fluxo simplificado:

1. O usuário interage com o frontend.
2. O frontend envia uma requisição à API.
3. O backend valida a autenticação e a autorização.
4. O backend valida os dados e executa as regras de negócio.
5. O backend consulta ou modifica o banco de dados.
6. A API devolve uma resposta ao frontend.

## 4. Isolamento entre empresas

O sistema utilizará uma arquitetura multi-tenant.

Cada empresa terá seus próprios clientes, usuários, equipamentos, ordens de serviço e documentos.

As operações protegidas deverão identificar a empresa autorizada a partir do contexto validado pelo backend.

O sistema não deverá confiar em um `company_id` enviado livremente pelo frontend para determinar o acesso.

As consultas, alterações, exclusões e relacionamentos deverão respeitar o isolamento entre empresas.

Restrições no banco de dados e testes automatizados serão utilizados para reduzir o risco de acesso cruzado.

## 5. Autenticação e autorização

O Supabase Auth será responsável pela autenticação dos usuários.

O backend validará os tokens recebidos e consultará o vínculo entre a identidade autenticada e a conta interna.

As permissões serão verificadas no backend conforme o perfil do usuário e a empresa associada.

Os perfis iniciais serão:

- ADMIN: administrador da plataforma.
- OWNER: proprietário de uma empresa.
- EMPLOYEE: funcionário de uma empresa.

O administrador da plataforma terá permissões separadas das permissões das empresas.

Contas suspensas ou inativas não poderão realizar operações protegidas.

## 6. Documentos e arquivos

Os PDFs emitidos, assinaturas digitalizadas e anexos serão armazenados em um serviço privado.

O banco de dados manterá os metadados necessários para localizar e controlar esses arquivos.

Cada versão emitida de um documento será preservada, sem sobrescrever versões anteriores.

O acesso aos arquivos dependerá de autorização no backend. Links temporários poderão ser utilizados quando apropriado.

## 7. Segurança

O sistema deverá:

- Validar entradas no backend.
- Aplicar autorização em todas as operações protegidas.
- Isolar os dados entre empresas.
- Utilizar HTTPS nos ambientes publicados.
- Manter segredos e credenciais fora do repositório.
- Não registrar senhas, tokens ou senhas de desbloqueio em logs.
- Proteger dados pessoais e arquivos privados.
- Registrar eventos importantes para auditoria.
- Utilizar testes automatizados para verificar permissões e isolamento.

## 8. Ambientes e configuração

O projeto deverá separar os ambientes de desenvolvimento, testes e produção.

Configurações específicas de cada ambiente serão fornecidas por variáveis de ambiente.

Arquivos com segredos não deverão ser versionados no Git.

Um arquivo `.env.example` poderá documentar os nomes das variáveis necessárias, utilizando valores fictícios e sem credenciais reais.

## 9. Evolução da arquitetura

A primeira versão será uma aplicação web para assistência técnica de celulares.

O backend deverá manter uma API independente da interface, permitindo avaliar futuramente clientes desktop e Android sem precisar reescrever as regras de negócio.

A expansão para outros segmentos dependerá de validação dos requisitos e testes específicos.

## 10. Decisões pendentes

Antes da implantação, deverão ser definidos:

- Provedor de armazenamento privado.
- Estratégia de implantação da API e do frontend.
- Estratégia de backup e restauração.
- Política de retenção e exclusão de dados.
- Configuração de monitoramento e logs.
- Regras finais de proteção de dados e documentos.