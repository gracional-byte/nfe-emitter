import * as fs from 'fs';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';

// Conectar ao banco de dados
const db = new Database(process.env.DATABASE_URL || 'file:./dev.db');

// Ler os arquivos PEM
const certPath = '/home/ubuntu/upload/chave_publica.pem';
const keyPath = '/home/ubuntu/upload/chave_privada.pem';

const certificateContent = fs.readFileSync(certPath, 'utf-8');
const privateKeyContent = fs.readFileSync(keyPath, 'utf-8');

// Calcular thumbprint SHA-1
function generateThumbprint(certPem) {
  try {
    const cert = certPem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\n/g, '');
    
    const der = Buffer.from(cert, 'base64');
    const hash = crypto.createHash('sha1').update(der).digest('hex');
    
    // Formatar com dois pontos
    return hash.match(/.{1,2}/g).join(':').toUpperCase();
  } catch (e) {
    console.error('Erro ao gerar thumbprint:', e);
    return 'UNKNOWN';
  }
}

const thumbprint = generateThumbprint(certificateContent);

console.log('Inserindo certificado no banco de dados...');
console.log('Thumbprint:', thumbprint);

try {
  // Usar um userId fictício (1) para teste
  const stmt = db.prepare(`
    INSERT INTO certificates (
      userId,
      certificateName,
      certificateContent,
      certificateKeyContent,
      thumbprint,
      isActive,
      expiresAt,
      createdAt,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  stmt.run(
    1, // userId
    'TERAPIAS INTEGRATIVAS VIBE LTDA',
    certificateContent,
    privateKeyContent,
    thumbprint,
    1, // isActive
    expiresAt.toISOString(),
    now.toISOString(),
    now.toISOString()
  );

  console.log('✅ Certificado inserido com sucesso!');
  
  // Verificar se foi inserido
  const result = db.prepare('SELECT * FROM certificates WHERE certificateName = ?').get('TERAPIAS INTEGRATIVAS VIBE LTDA');
  console.log('\n=== CERTIFICADO INSERIDO ===');
  console.log('ID:', result.id);
  console.log('Nome:', result.certificateName);
  console.log('Thumbprint:', result.thumbprint);
  console.log('Ativo:', result.isActive);
  console.log('Expira em:', result.expiresAt);
  
} catch (error) {
  console.error('❌ Erro ao inserir certificado:', error.message);
  process.exit(1);
}

db.close();
