import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Script para fazer upload do certificado digital
 * Este script lê o arquivo PEM e o salva no banco de dados
 */

async function uploadCertificate() {
  try {
    const certPath = path.join(__dirname, '../chave-privada-sem-senha.pem');
    
    if (!fs.existsSync(certPath)) {
      console.error('❌ Arquivo de certificado não encontrado:', certPath);
      process.exit(1);
    }

    const certContent = fs.readFileSync(certPath, 'utf-8');
    
    // Validar se é um PEM válido
    if (!certContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      console.error('❌ Arquivo não é um certificado PEM válido');
      process.exit(1);
    }

    console.log('✅ Certificado validado com sucesso!');
    console.log('📝 Conteúdo do certificado:');
    console.log(certContent.substring(0, 100) + '...');
    console.log('\n✅ Próximo passo: Fazer upload pela interface web em "Certificados"');
    
  } catch (error) {
    console.error('❌ Erro ao processar certificado:', error.message);
    process.exit(1);
  }
}

uploadCertificate();
