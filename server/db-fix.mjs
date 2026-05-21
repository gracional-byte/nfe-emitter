import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function fixCertificates() {
  const connection = await pool.getConnection();
  
  try {
    // Verificar se há certificados com campos NULL
    const [rows] = await connection.query(
      'SELECT id, certificateName, certificateContent, certificateKeyContent FROM certificates WHERE certificateContent IS NULL OR certificateKeyContent IS NULL'
    );
    
    console.log('Certificados com campos NULL:', rows.length);
    
    if (rows.length > 0) {
      console.log('Certificados encontrados com campos incompletos:');
      rows.forEach(cert => {
        console.log(`- ID: ${cert.id}, Nome: ${cert.certificateName}`);
        console.log(`  certificateContent: ${cert.certificateContent ? 'OK' : 'NULL'}`);
        console.log(`  certificateKeyContent: ${cert.certificateKeyContent ? 'OK' : 'NULL'}`);
      });
    }
    
    // Verificar estrutura da tabela
    const [columns] = await connection.query('DESCRIBE certificates');
    console.log('\nEstrutura da tabela certificates:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} (NULL: ${col.Null})`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await connection.end();
    await pool.end();
  }
}

fixCertificates();
