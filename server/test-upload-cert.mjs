import * as fs from 'fs';

// Ler os arquivos PEM
const certPath = '/home/ubuntu/upload/chave_publica.pem';
const keyPath = '/home/ubuntu/upload/chave_privada.pem';

const certificateContent = fs.readFileSync(certPath, 'utf-8');
const privateKeyContent = fs.readFileSync(keyPath, 'utf-8');

console.log('=== CERTIFICADO ===');
console.log(certificateContent.substring(0, 100) + '...');
console.log('\n=== CHAVE PRIVADA ===');
console.log(privateKeyContent.substring(0, 100) + '...');

// Validar formato
const isCertValid = certificateContent.includes('-----BEGIN CERTIFICATE-----');
const isKeyValid = privateKeyContent.includes('-----BEGIN PRIVATE KEY-----') || 
                   privateKeyContent.includes('-----BEGIN RSA PRIVATE KEY-----');

console.log('\n=== VALIDAÇÃO ===');
console.log('Certificado válido:', isCertValid);
console.log('Chave privada válida:', isKeyValid);

// Dados para upload
const uploadData = {
  certificateName: 'TERAPIAS INTEGRATIVAS VIBE LTDA',
  certificateContent: certificateContent,
  fileType: 'pem',
  privateKey: privateKeyContent,
};

console.log('\n=== DADOS PARA UPLOAD ===');
console.log(JSON.stringify({
  certificateName: uploadData.certificateName,
  fileType: uploadData.fileType,
  certificateContentLength: uploadData.certificateContent.length,
  privateKeyLength: uploadData.privateKey.length,
}, null, 2));
