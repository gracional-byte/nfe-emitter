# Sistema de Emissão de RPS/NFS-e - TODO

## Banco de Dados
- [x] Criar tabela de configurações da empresa (CNPJ, InscricaoMunicipal, dados de tributação)
- [x] Criar tabela de certificados digitais (armazenar referência S3 da chave privada)
- [x] Criar tabela de notas fiscais (RPS/NFS-e com status, dados do tomador, valor)
- [x] Criar tabela de arquivos gerados (PDFs, XMLs assinados)
- [x] Executar migrações SQL

## Back-end - Assinatura Digital e SOAP
- [x] Implementar função de assinatura XML com RSA-SHA256
- [x] Implementar integração SOAP com Prefeitura de SP (estrutura preparada)
- [x] Criar procedure para emissão de RPS
- [ ] Criar procedure para geração de PDF/DANFSe
- [x] Implementar tratamento de erros e retry logic
- [x] Adicionar logs de auditoria para cada emissão

## Back-end - Gerenciamento de Certificados
- [x] Criar endpoint para upload seguro de certificado (.pem)
- [x] Implementar validação de certificado
- [x] Armazenar certificado no S3 com criptografia
- [x] Criar endpoint para listar certificados ativos

## Back-end - Configurações da Empresa
- [x] Criar endpoint para salvar/atualizar dados tributários padrão
- [x] Criar endpoint para recuperar configurações da empresa

## Back-end - Notificações
- [x] Integrar sistema de notificações para sucesso de emissão
- [x] Integrar sistema de notificações para erros críticos

## Front-end - Formulário de Emissão
- [x] Criar formulário com campos: Nome, CPF/CNPJ, Endereço, Serviço, Valor, Observações
- [x] Implementar validação de CPF/CNPJ
- [x] Pré-preencher campos de tributação a partir das configurações da empresa
- [x] Implementar submit com loading state

## Front-end - Painel Administrativo
- [x] Criar página de configurações da empresa
- [x] Implementar upload seguro de certificado digital
- [x] Criar interface para gerenciar dados tributários padrão
- [x] Adicionar validação visual de certificado ativo

## Front-end - Histórico de Notas Fiscais
- [x] Criar tabela com histórico de emissões
- [ ] Implementar filtros por data, status, tomador
- [x] Adicionar paginação
- [x] Criar ações: visualizar XML, download PDF

## Front-end - Visualização de Documentos
- [x] Implementar modal para visualizar XML assinado
- [ ] Implementar download de PDF/DANFSe
- [x] Implementar download de XML assinado

## Front-end - Dashboard
- [x] Exibir total de notas emitidas
- [x] Exibir notas do mês
- [x] Exibir valor total emitido
- [ ] Exibir gráfico de emissões por período
- [x] Exibir status dos últimos certificados

## Front-end - Autenticação e Segurança
- [x] Implementar login via Manus OAuth
- [x] Criar proteção de rotas (apenas admin pode acessar)
- [x] Implementar logout
- [x] Adicionar validação algorítmica de CPF/CNPJ no front-end

## Testes
- [ ] Escrever testes unitários para assinatura XML
- [x] Escrever testes para validação de CPF/CNPJ
- [ ] Testar integração SOAP com prefeitura (mock)

## Deployment
- [x] Criar checkpoint final
- [ ] Publicar sistema
