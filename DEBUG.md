# Problema: Erro ao Emitir RPS

## Erro Reportado
```
Erro ao emitir RPS: Failed to parse URL from /manus-storage/certificates/1/private-key.pem
```

## O que foi feito
1. Criado sistema completo de emissão de RPS/NFS-e
2. Adicionada coluna `certificateKeyContent` ao banco de dados para armazenar a chave privada
3. Chave privada extraída do PFX (senha: 123456) e inserida no banco de dados
4. Código atualizado para ler `certificateKeyContent` em vez de fazer fetch de URL
5. Função `uploadCertificate` atualizada para salvar `certificateKeyContent`

## Certificado Atual
- **ID**: 1
- **Nome**: VIBE PINHEIROS - PFX
- **Thumbprint**: A603CC1633830AB9DB27A534A9435726D32A4468
- **Status**: Ativo
- **Chave Privada**: Armazenada em `certificates.certificateKeyContent`

## Arquivos Principais
- `/home/ubuntu/nfe-emitter/server/routers/nfe.ts` - Lógica de emissão de RPS
- `/home/ubuntu/nfe-emitter/server/db.ts` - Funções de banco de dados
- `/home/ubuntu/nfe-emitter/drizzle/schema.ts` - Schema do banco de dados
- `/home/ubuntu/nfe-emitter/server/nfe-service.ts` - Serviço de assinatura XML

## Próximas Etapas
1. Verificar se o erro vem de outro lugar no código
2. Adicionar logs detalhados para debugar
3. Considerar usar uma abordagem diferente para armazenar/recuperar a chave privada

## Informações de Acesso
- **URL do Projeto**: https://nfenotafis-xkfsmmyp.manus.space
- **Banco de Dados**: MySQL com Drizzle ORM
- **Autenticação**: Manus OAuth
