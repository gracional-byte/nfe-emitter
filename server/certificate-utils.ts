import * as forge from 'node-forge';

/**
 * Extrair informações do certificado X.509
 */
export function extractCertificateInfo(certificatePem: string): {
  cnpj?: string;
  subject?: string;
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
} {
  try {
    const cert = forge.pki.certificateFromPem(certificatePem);
    
    // Extrair CNPJ do subject
    let cnpj: string | undefined;
    if (cert.subject && cert.subject.attributes) {
      // Procurar por CN (Common Name) que pode conter CNPJ
      const cnAttr = cert.subject.attributes.find(attr => attr.name === 'commonName');
      if (cnAttr && cnAttr.value) {
        // Tentar extrair CNPJ do CN (formato: "CNPJ 12.345.678/0001-99")
        const cnpjMatch = (cnAttr.value as string).match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
        if (cnpjMatch) {
          cnpj = cnpjMatch[1];
        }
      }
    }

    return {
      cnpj,
      subject: cert.subject?.toString(),
      issuer: cert.issuer?.toString(),
      validFrom: cert.validity?.notBefore,
      validTo: cert.validity?.notAfter,
    };
  } catch (error) {
    console.error('Erro ao extrair informações do certificado:', error);
    return {};
  }
}
