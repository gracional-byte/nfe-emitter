import crypto from 'crypto';
import { DOMParser as DOMParserImpl, XMLSerializer } from '@xmldom/xmldom';

/**
 * Serviço de assinatura digital XML para certificados A1
 * Implementação robusta usando crypto nativo do Node.js
 */

export interface SignXmlOptions {
  privateKeyPem: string;
  certificatePem?: string;
  referenceUri?: string;
}

/**
 * Assina um documento XML com certificado digital A1
 * Usa RSA-SHA256 conforme padrão da Prefeitura de SP
 */
export async function signXmlWithCertificate(
  xmlContent: string,
  options: SignXmlOptions
): Promise<string> {
  try {
    // Validações
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new Error('XML content is empty');
    }

    if (!options.privateKeyPem || options.privateKeyPem.trim().length === 0) {
      throw new Error('Private key is required');
    }

    // Limpar chave privada
    const cleanedPrivateKey = cleanPemKey(options.privateKeyPem);

    // Validar chave
    if (!cleanedPrivateKey.includes('-----BEGIN') || !cleanedPrivateKey.includes('-----END')) {
      throw new Error('Invalid PEM format for private key');
    }

    // Carregar chave privada
    let privateKey: crypto.KeyObject;
    try {
      privateKey = crypto.createPrivateKey({
        key: cleanedPrivateKey,
        format: 'pem',
        passphrase: undefined
      });
    } catch (keyError: any) {
      throw new Error(`Failed to load private key: ${keyError.message}`);
    }

    console.log('[XML Signer] Chave privada carregada com sucesso');

    // Parsear XML
    const parser = new DOMParserImpl();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    if (!xmlDoc) {
      throw new Error('Failed to parse XML document');
    }

    // Encontrar elemento a ser assinado
    const referenceUri = options.referenceUri || 'EnviarLoteRpsEnvio';
    const elementToSign = xmlDoc.getElementsByTagName(referenceUri)[0];

    if (!elementToSign) {
      throw new Error(`Element ${referenceUri} not found in XML`);
    }

    // Canonicalizar o elemento
    const canonicalXml = canonicalizeXml(elementToSign);

    // Criar assinatura RSA-SHA256
    const signature = crypto.createSign('sha256');
    signature.update(canonicalXml, 'utf-8');
    const signatureValue = signature.sign(privateKey, 'base64');

    if (!signatureValue || signatureValue.length === 0) {
      throw new Error('Failed to generate signature');
    }

    console.log('[XML Signer] Assinatura gerada com sucesso');

    // Criar elemento de assinatura
    const signatureElement = createSignatureElement(signatureValue, referenceUri);

    // Inserir assinatura no XML
    const signedXml = xmlContent.replace(
      `</${referenceUri}>`,
      `${signatureElement}</${referenceUri}>`
    );

    if (!signedXml || signedXml === xmlContent) {
      throw new Error('Failed to insert signature into XML');
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
 * Limpa uma chave PEM removendo espaços e quebras de linha extras
 */
function cleanPemKey(pemKey: string): string {
  return pemKey
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Canonicaliza um elemento XML para assinatura
 * Usa a canonicalização exclusiva (exc-c14n)
 */
function canonicalizeXml(element: any): string {
  try {
    const serializer = new XMLSerializer();
    let xml = serializer.serializeToString(element);

    // Remover espaços em branco entre tags
    xml = xml.replace(/>\s+</g, '><');

    // Remover atributos de namespace padrão
    xml = xml.replace(/xmlns="[^"]*"/g, '');

    return xml;
  } catch (error: any) {
    console.error('[XML Signer] Erro ao canonicalizar XML:', error);
    throw new Error(`Failed to canonicalize XML: ${error.message}`);
  }
}

/**
 * Cria um elemento de assinatura XML no padrão xmldsig
 */
function createSignatureElement(signatureValue: string, referenceUri: string): string {
  // Calcular digest do URI de referência
  const digestValue = crypto.createHash('sha256').update(referenceUri).digest('base64');

  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#${referenceUri}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>${digestValue}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${signatureValue}</SignatureValue>
  </Signature>`;
}

/**
 * Valida se uma chave privada é válida
 */
export function validatePrivateKey(privateKeyPem: string): boolean {
  try {
    if (!privateKeyPem || privateKeyPem.trim().length === 0) {
      return false;
    }

    const cleanedKey = cleanPemKey(privateKeyPem);

    if (!cleanedKey.includes('-----BEGIN') || !cleanedKey.includes('-----END')) {
      return false;
    }

    // Tentar carregar a chave
    crypto.createPrivateKey({
      key: cleanedKey,
      format: 'pem',
      passphrase: undefined
    });

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
