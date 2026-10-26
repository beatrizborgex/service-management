# Requisitos do Sistema

## 1. Objetivo

Desenvolver uma aplicação web para gerenciamento de ordens de serviço, começando por assistências técnicas de celulares e mantendo a arquitetura preparada para futuros segmentos.

## 2. Perfis de usuário

### Administrador da plataforma
- Cadastrar empresas durante o período piloto.
- Criar contas de proprietários.
- Ativar e suspender empresas e contas.
- Consultar indicadores operacionais básicos.

### Proprietário da empresa
- Gerenciar os dados da empresa.
- Cadastrar e administrar funcionários.
- Cadastrar e consultar clientes.
- Criar e gerenciar ordens de serviço.
- Consultar documentos e histórico dos atendimentos.

### Funcionário
- Cadastrar e consultar clientes.
- Abrir e editar ordens de serviço conforme as permissões.
- Atualizar o status dos atendimentos.
- Registrar diagnósticos e orçamentos.
- Gerar documentos autorizados.

## 3. Requisitos funcionais

- RF01: autenticar usuários.
- RF02: isolar os dados de cada empresa.
- RF03: permitir o cadastro e a consulta de clientes.
- RF04: permitir a abertura de ordens de serviço.
- RF05: registrar identificação do aparelho e acessórios recebidos.
- RF06: registrar o relato do cliente e o diagnóstico técnico.
- RF07: registrar orçamento e aprovação do cliente.
- RF08: controlar status e histórico das ordens.
- RF09: gerar e preservar versões dos documentos PDF.
- RF10: permitir anexar a assinatura digitalizada do cliente.
- RF11: oferecer consulta pública restrita por QR Code e consulta manual validada.
- RF12: registrar condições de garantia informadas para cada serviço.
- RF13: vincular ordens de retorno à ordem original.
- RF14: registrar cancelamentos e suas justificativas.
- RF15: permitir que o proprietário gerencie os funcionários.
- RF16: permitir que o administrador da plataforma gerencie empresas durante o piloto.

## 4. Regras de negócio

- Cada ordem de serviço pertence a uma única empresa.
- Cada ordem registra um cliente e um equipamento.
- O número da OS é sequencial dentro da empresa e alocado de forma segura.
- O fluxo normal de atendimento é: ENTRADA, EM ANDAMENTO e CONCLUÍDO.
- O cancelamento exige justificativa e registro de auditoria.
- Uma OS concluída não pode ser reaberta; retornos são registrados em novas OS vinculadas à original.
- A aprovação do orçamento deve ser registrada separadamente de sua emissão.
- A garantia registrada deve refletir as condições informadas ao cliente e respeitar a legislação aplicável.
- Documentos emitidos anteriormente não podem ser sobrescritos.
- O acesso a dados e arquivos depende das permissões do usuário e da empresa à qual pertence.

## 5. Segurança e privacidade

- Validar autenticação e permissões no backend.
- Impedir acesso cruzado entre empresas.
- Armazenar arquivos em local privado.
- Não expor dados pessoais ou documentos na consulta pública.
- Utilizar tokens aleatórios e revogáveis para consulta por QR Code.
- Proteger qualquer senha de desbloqueio eventualmente armazenada e eliminá-la quando deixar de ser necessária.
- Registrar ações relevantes para auditoria.
- Definir políticas de retenção e exclusão de dados.
- Revisar requisitos de LGPD e legislação de defesa do consumidor antes do lançamento comercial.

## 6. Escopo inicial

A primeira versão atenderá assistências técnicas de celulares, com cadastro de clientes, ordens de serviço, controle de atendimento e geração de documentos.

O segmento automotivo, o cadastro público de empresas e os aplicativos desktop e Android ficam fora do lançamento inicial.

## 7. Critérios gerais de qualidade

- Código organizado e tipado com TypeScript.
- Testes automatizados para regras importantes.
- Documentação das decisões técnicas.
- Histórico de alterações pelo Git.
- Configurações e segredos fora do repositório público.
- Preparação para implantação e manutenção futuras.