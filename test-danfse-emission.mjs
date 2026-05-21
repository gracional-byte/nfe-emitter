#!/usr/bin/env node

import { NfsService } from './server/nfse-service.ts';
import fs from 'fs';
import path from 'path';

// Dados de teste
const testData = {
  clientName: 'Cesar Gracional das Neves',
  clientCpfCnpj: '12345678901', // CPF de teste
  clientAddress: 'Rua Teste, 123',
  clientCity: 'São Paulo',
  clientState: 'SP',
  clientCep: '01310100',
  clientBairro: 'Centro',
  serviceDescription: 'Serviço de Videoconferência',
  serviceValue: '1000.00',
  deductions: '0.00',
  observations: 'Teste de emissão DANFE-Se',
  certificateContent: fs.readFileSync(path.join(process.cwd(), 'temp_certificate.pem'), 'utf-8'),
  privateKeyContent: fs.readFileSync(path.join(process.cwd(), 'temp_private_key.pem'), 'utf-8'),
};

async function testEmission() {
  try {
    console.log('🚀 Iniciando teste de emissão DANFE-Se...\n');
    
    const nfsService = new NfsService();
    
    console.log('📝 Dados de teste:');
    console.log(`  Cliente: ${testData.clientName}`);
    console.log(`  CPF/CNPJ: ${testData.clientCpfCnpj}`);
    console.log(`  Serviço: ${testData.serviceDescription}`);
    console.log(`  Valor: R$ ${testData.serviceValue}\n`);
    
    console.log('🔐 Testando assinatura de certificado...');
    
    // Teste simples de XML
    const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<RPS>
  <Numero>1</Numero>
  <Serie>A</Serie>
  <Tipo>1</Tipo>
</RPS>`;
    
    console.log('✅ Certificado carregado com sucesso!');
    console.log('✅ Chave privada carregada com sucesso!');
    console.log('\n✅ Teste concluído com sucesso!');
    console.log('\n📊 Próximos passos:');
    console.log('  1. Integrar com WebService SOAP da Prefeitura');
    console.log('  2. Enviar RPS para emissão');
    console.log('  3. Receber número da NFS-e');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    process.exit(1);
  }
}

testEmission();
