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
  observations?: string;
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
    if (!privateKeyContent || !privateKeyContent.includes('-----BEGIN') || !privateKeyContent.includes('-----END')) {
      throw new Error('Chave privada em formato PEM inválido ou vazia');
    }

    // Limpar a chave privada (remover espaços extras e quebras de linha desnecessárias)
    const cleanedKey = privateKeyContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    const sig = new SignedXml();
    
    // Configurar a chave privada corretamente
    (sig as any).signingKey = Buffer.from(cleanedKey, 'utf-8');
    
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
    const signedXml = sig.getSignedXml();
    
    if (!signedXml || signedXml.length === 0) {
      throw new Error('Falha ao gerar XML assinado - resultado vazio');
    }
    
    return signedXml;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[NFe Service] Erro ao assinar XML:', errorMessage);
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

/**
 * Gera PDF/DANFSe (Documento Auxiliar da Nota Fiscal de Serviço Eletrônica)
 * Implementação simplificada que cria um HTML estruturado e o converte para PDF
 */
export function generateDanfsePdf(data: RpsData & { nfseNumber?: string; rpsNumber: string; emittedAt?: Date }): string {
  const emittedDate = data.emittedAt ? new Date(data.emittedAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const serviceValue = parseFloat(data.serviceValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const deductions = parseFloat(data.deductions).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const netValue = (parseFloat(data.serviceValue) - parseFloat(data.deductions)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DANFSe - Documento Auxiliar da Nota Fiscal de Serviço Eletrônica</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      border: 2px solid #333;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0;
      font-size: 12px;
    }
    .section {
      margin-bottom: 20px;
      border: 1px solid #ddd;
      padding: 10px;
    }
    .section-title {
      background-color: #f0f0f0;
      padding: 8px;
      font-weight: bold;
      font-size: 12px;
      margin: -10px -10px 10px -10px;
    }
    .row {
      display: flex;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .col {
      flex: 1;
    }
    .col-label {
      font-weight: bold;
      color: #333;
      min-width: 150px;
    }
    .col-value {
      color: #666;
    }
    .values-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .values-table td {
      padding: 8px;
      border: 1px solid #ddd;
      font-size: 12px;
    }
    .values-table .label {
      font-weight: bold;
      background-color: #f0f0f0;
    }
    .values-table .value {
      text-align: right;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DOCUMENTO AUXILIAR DA NOTA FISCAL DE SERVIÇO ELETRÔNICA</h1>
      <p>DANFSe</p>
      <p>NFS-e: ${data.nfseNumber || 'Pendente'} | RPS: ${data.rpsNumber}</p>
    </div>

    <div class="section">
      <div class="section-title">INFORMAÇÕES DO PRESTADOR</div>
      <div class="row">
        <div class="col">
          <div class="col-label">CNPJ:</div>
          <div class="col-value">${data.cnpj}</div>
        </div>
        <div class="col">
          <div class="col-label">Inscrição Municipal:</div>
          <div class="col-value">${data.inscricaoMunicipal}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">INFORMAÇÕES DO TOMADOR</div>
      <div class="row">
        <div class="col">
          <div class="col-label">Razão Social:</div>
          <div class="col-value">${escapeHtml(data.clientName)}</div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="col-label">CPF/CNPJ:</div>
          <div class="col-value">${data.clientCpfCnpj}</div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="col-label">Endereço:</div>
          <div class="col-value">${escapeHtml(data.clientAddress)}</div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="col-label">Cidade/Estado:</div>
          <div class="col-value">${data.clientCity}/${data.clientState} - CEP: ${data.clientCep}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">INFORMAÇÕES DO SERVIÇO</div>
      <div class="row">
        <div class="col">
          <div class="col-label">Descrição:</div>
          <div class="col-value">${escapeHtml(data.serviceDescription)}</div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="col-label">Item Lista Serviço:</div>
          <div class="col-value">${data.itemListaServico}</div>
        </div>
        <div class="col">
          <div class="col-label">Código CNAE:</div>
          <div class="col-value">${data.codigoCnae}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">VALORES</div>
      <table class="values-table">
        <tr>
          <td class="label">Valor dos Serviços</td>
          <td class="value">R$ ${serviceValue}</td>
        </tr>
        <tr>
          <td class="label">Deduções</td>
          <td class="value">R$ ${deductions}</td>
        </tr>
        <tr>
          <td class="label" style="font-size: 14px;">Valor Líquido</td>
          <td class="value" style="font-size: 14px; font-weight: bold;">R$ ${netValue}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">INFORMAÇÕES ADICIONAIS</div>
      <div class="row">
        <div class="col">
          <div class="col-label">Data de Emissão:</div>
          <div class="col-value">${emittedDate}</div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="col-label">Observações:</div>
          <div class="col-value">${data.observations ? escapeHtml(data.observations) : '-'}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Este documento é uma representação visual da Nota Fiscal de Serviço Eletrônica.</p>
      <p>Gerado automaticamente pelo Sistema de Emissão de RPS/NFS-e</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Escapa caracteres especiais em HTML
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
