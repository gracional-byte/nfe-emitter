import crypto from 'crypto';
import { SignedXml } from 'xml-crypto';
import { storageGet } from './storage';

/**
 * Serviço de assinatura digital e integração com Prefeitura de SP
 */

interface SignatureOptions {
  privateKeyContent: string;
  certificateThumbprint: string;
}

interface RpsData {
  numeroLote: string;
  cnpj: string;
  inscricaoMunicipal: string;
  rpsNumber: string;
  rpsSeries: string;
  rpsType: string;
  clientName: string;
  clientCpfCnpj: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientCep: string;
  serviceDescription: string;
  serviceValue: string;
  deductions: string;
  itemListaServico: string;
  codigoCnae: string;
  regimeEspecialTributacao: string;
  optanteSimplesNacional: string;
  incentivadorCultural: string;
}

/**
 * Gera XML do RPS não assinado
 */
export function generateRpsXml(data: RpsData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.prefeitura.sp.gov.br/nfe">
  <LoteRps>
    <NumeroLote>${data.numeroLote}</NumeroLote>
    <Cnpj>${data.cnpj}</Cnpj>
    <InscricaoMunicipal>${data.inscricaoMunicipal}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <IdentificacaoRps>
          <Numero>${data.rpsNumber}</Numero>
          <Serie>${data.rpsSeries}</Serie>
          <Tipo>${data.rpsType}</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${new Date().toISOString()}</DataEmissao>
        <Prestador>
          <Cnpj>${data.cnpj}</Cnpj>
          <InscricaoMunicipal>${data.inscricaoMunicipal}</InscricaoMunicipal>
        </Prestador>
        <Tomador>
          <IdentificacaoTomador>
            <CpfCnpj>
              <Cnpj>${data.clientCpfCnpj}</Cnpj>
            </CpfCnpj>
          </IdentificacaoTomador>
          <RazaoSocial>${escapeXml(data.clientName)}</RazaoSocial>
          <Endereco>
            <Endereco>${escapeXml(data.clientAddress)}</Endereco>
            <Bairro>Centro</Bairro>
            <CodigoMunicipio>3550308</CodigoMunicipio>
            <Uf>${data.clientState}</Uf>
            <Cep>${data.clientCep}</Cep>
          </Endereco>
        </Tomador>
        <Servico>
          <Valores>
            <ValorServicos>${parseFloat(data.serviceValue).toFixed(2)}</ValorServicos>
            <ValorDeducoes>${parseFloat(data.deductions).toFixed(2)}</ValorDeducoes>
          </Valores>
          <ItemListaServico>${data.itemListaServico}</ItemListaServico>
          <CodigoCnae>${data.codigoCnae}</CodigoCnae>
          <Discriminacao>${escapeXml(data.serviceDescription)}</Discriminacao>
        </Servico>
        <RegimeEspecialTributacao>${data.regimeEspecialTributacao}</RegimeEspecialTributacao>
        <OptanteSimplesNacional>${data.optanteSimplesNacional}</OptanteSimplesNacional>
        <IncentivadorCultural>${data.incentivadorCultural}</IncentivadorCultural>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}

/**
 * Assina o XML com a chave privada usando RSA-SHA256
 */
export async function signXml(
  xmlContent: string,
  privateKeyContent: string,
  certificateThumbprint: string
): Promise<string> {
  try {
    // Validar que a chave privada está em formato PEM válido
    if (!privateKeyContent.includes('-----BEGIN') || !privateKeyContent.includes('-----END')) {
      throw new Error('Chave privada em formato PEM inválido');
    }

    const sig = new SignedXml();
    
    // Configurar a chave privada como Buffer
    (sig as any).signingKey = Buffer.from(privateKeyContent);
    
    // Configurar algoritmos de assinatura
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

    // Adicionar referência para o elemento raiz
    sig.addReference({
      xpath: "//*[local-name(.)='EnviarLoteRpsEnvio']",
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
    });

    // Computar assinatura
    sig.computeSignature(xmlContent);
    
    // Retornar XML assinado
    return sig.getSignedXml();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Falha ao assinar XML: ${errorMessage}`);
  }
}

/**
 * Valida certificado PEM
 */
export function validatePrivateKey(keyContent: string): boolean {
  try {
    // Verificar formato PEM básico
    if (!keyContent.includes('-----BEGIN') || !keyContent.includes('-----END')) {
      return false;
    }

    // Tentar extrair a chave usando crypto
    const keyBuffer = Buffer.from(keyContent);
    crypto.createPrivateKey({
      key: keyBuffer,
      format: 'pem'
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Gera thumbprint do certificado (identificador único)
 */
export function generateThumbprint(certificateName: string): string {
  return crypto
    .createHash('sha256')
    .update(certificateName + Date.now())
    .digest('hex')
    .substring(0, 32);
}

/**
 * Escapa caracteres especiais em XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formata CNPJ para padrão brasileiro
 */
export function formatCnpj(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Valida CNPJ
 */
export function validateCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Calcular primeiro dígito verificador
  let sum = 0;
  let multiplier = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  // Calcular segundo dígito verificador
  sum = 0;
  multiplier = 6;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  sum += firstDigit * 2;
  const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return parseInt(cleaned[12]) === firstDigit && parseInt(cleaned[13]) === secondDigit;
}

/**
 * Valida CPF
 */
export function validateCpf(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Calcular primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  // Calcular segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  sum += firstDigit * 2;
  const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return parseInt(cleaned[9]) === firstDigit && parseInt(cleaned[10]) === secondDigit;
}

/**
 * Valida CPF ou CNPJ
 */
export function validateCpfOrCnpj(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return validateCpf(value);
  } else if (cleaned.length === 14) {
    return validateCnpj(value);
  }
  
  return false;
}
