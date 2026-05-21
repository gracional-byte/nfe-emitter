import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

/**
 * Serviço de assinatura digital XML para NFSe SP
 * Implementação correta usando xml-crypto puro
 * 
 * Baseado em recomendação profissional:
 * - xml-crypto gerencia TUDO (Signature, transforms, namespaces, canonicalization)
 * - Sem criação manual de elementos
 * - Sem remoção de namespaces
 * - Sem digest manual
 */

export interface SignXmlOptions {
  privateKeyPem: string;
  certificatePem?: string;
  referenceUri?: string;
}

/**
 * Assina um documento XML com certificado digital A1
 * Implementação profissional para NFSe Prefeitura SP
 */
export function signXml(
  xmlContent: string,
  privateKeyPem: string,
  certificatePem?: string
): string {
  try {
    // Validações
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new Error('XML content is empty');
    }

    if (!privateKeyPem || privateKeyPem.trim().length === 0) {
      throw new Error('Private key is required');
    }

    // Validar formato PEM
    if (!privateKeyPem.includes('-----BEGIN PRIVATE KEY-----') && 
        !privateKeyPem.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      throw new Error('Invalid private key format. Expected "-----BEGIN PRIVATE KEY-----" or "-----BEGIN RSA PRIVATE KEY-----"');
    }

    console.log('[XML Signer] Iniciando assinatura XML');

    // Criar assinador
    const sig = new SignedXml();

    // Configurar chave privada
    sig.privateKey = privateKeyPem;

    // Configurar algoritmos conforme padrão W3C RFC 3275
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

    // Adicionar referência para o elemento InfDeclaracaoPrestacaoServico
    // (padrão da Prefeitura SP para NFSe)
    sig.addReference({
      xpath: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']",
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#'
      ]
    });

    // Configurar KeyInfo (X509Data vazio conforme padrão SP)
    sig.keyInfoProvider = {
      getKeyInfo() {
        return '<X509Data></X509Data>';
      }
    };

    // Computar assinatura
    // xml-crypto faz TUDO corretamente:
    // 1. Extrai elemento via xpath
    // 2. Canonicaliza elemento
    // 3. Calcula digest do elemento canonicalizado
    // 4. Monta SignedInfo
    // 5. Canonicaliza SignedInfo
    // 6. Assina SignedInfo com RSA-SHA256
    // 7. Insere Signature no XML preservando namespaces e ordem
    sig.computeSignature(xmlContent);

    // Obter XML assinado
    const signedXml = sig.getSignedXml();

    if (!signedXml || signedXml.length === 0) {
      throw new Error('Failed to generate signed XML');
    }

    console.log('[XML Signer] XML assinado com sucesso');
    return signedXml;

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[XML Signer] Erro ao assinar XML:', errorMessage);
    throw new Error(`Failed to sign XML: ${errorMessage}`);
  }
}

/**
 * Valida se uma chave privada está em formato PEM válido
 */
export function validatePrivateKey(privateKeyPem: string): boolean {
  try {
    if (!privateKeyPem || privateKeyPem.trim().length === 0) {
      return false;
    }

    const hasValidHeader = 
      privateKeyPem.includes('-----BEGIN PRIVATE KEY-----') ||
      privateKeyPem.includes('-----BEGIN RSA PRIVATE KEY-----');

    const hasValidFooter = privateKeyPem.includes('-----END');

    if (!hasValidHeader || !hasValidFooter) {
      console.error('[XML Signer] Chave privada sem formato PEM válido');
      return false;
    }

    console.log('[XML Signer] Chave privada validada com sucesso');
    return true;
  } catch (error: any) {
    console.error('[XML Signer] Erro ao validar chave privada:', error.message);
    return false;
  }
}

/**
 * Calcula o thumbprint SHA-1 de um certificado X.509
 */
export function calculateCertificateThumbprint(certificatePem: string): string {
  try {
    const crypto = require('crypto');

    if (!certificatePem.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error('Invalid certificate format. Expected "-----BEGIN CERTIFICATE-----"');
    }

    const cleanedCert = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    const buffer = Buffer.from(cleanedCert, 'base64');
    const thumbprint = crypto.createHash('sha1').update(buffer).digest('hex').toUpperCase();

    return thumbprint;
  } catch (error: any) {
    console.error('[XML Signer] Erro ao calcular thumbprint:', error.message);
    throw new Error(`Failed to calculate certificate thumbprint: ${error.message}`);
  }
}
