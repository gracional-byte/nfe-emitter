/**
 * Gerador de XML para DANFE-Se (NFS-e) conforme padrão da Prefeitura de SP
 * Baseado na documentação de schemas da Prefeitura
 */

export interface DanfSeData {
  // Identificação do RPS
  rpsNumber: string;
  rpsSeriesNumber: string;
  rpsDate: Date;

  // Dados do prestador (empresa)
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  prestadorRazaoSocial: string;

  // Dados do tomador (cliente)
  tomadorCpfCnpj: string;
  tomadorRazaoSocial: string;
  tomadorLogradouro: string;
  tomadorNumero: string;
  tomadorComplemento?: string;
  tomadorBairro: string;
  tomadorCidade: string;
  tomadorEstado: string;
  tomadorCep: string;

  // Dados do serviço
  servicoDescricao: string;
  servicoValor: number;
  servicoAliquotaIss: number;
  servicoItemLista: string;

  // Deduções
  deducoes?: number;
  desconto?: number;

  // Observações
  observacoes?: string;
}

/**
 * Gera o XML do RPS para envio à Prefeitura de SP
 */
export function generateRpsXml(data: DanfSeData): string {
  const rpsDate = formatDate(data.rpsDate);
  const issValue = (data.servicoValor * data.servicoAliquotaIss) / 100;
  const netValue = data.servicoValor - (data.deducoes || 0) - (data.desconto || 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.prefeitura.sp.gov.br/nfe">
  <LoteRps>
    <NumeroLote>1</NumeroLote>
    <Cnpj>${data.prestadorCnpj}</Cnpj>
    <InscricaoMunicipal>${data.prestadorInscricaoMunicipal}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfRps Id="rps${data.rpsNumber}">
          <IdentificacaoRps>
            <Numero>${data.rpsNumber}</Numero>
            <Serie>${data.rpsSeriesNumber}</Serie>
            <Tipo>1</Tipo>
          </IdentificacaoRps>
          <DataEmissao>${rpsDate}</DataEmissao>
          <NaturezaOperacao>1</NaturezaOperacao>
          <RegimeEspecialTributacao>0</RegimeEspecialTributacao>
          <OptanteSimplesNacional>2</OptanteSimplesNacional>
          <IncentivadorCultural>2</IncentivadorCultural>
          <Status>1</Status>
          <Servico>
            <ItemListaServico>${data.servicoItemLista}</ItemListaServico>
            <Descricao>${escapeXml(data.servicoDescricao)}</Descricao>
            <Valor>${data.servicoValor.toFixed(2)}</Valor>
            <IssRetido>2</IssRetido>
            <Descontos>${(data.desconto || 0).toFixed(2)}</Descontos>
            <Deducoes>${(data.deducoes || 0).toFixed(2)}</Deducoes>
            <ValorIss>${issValue.toFixed(2)}</ValorIss>
            <AliquotaIss>${data.servicoAliquotaIss.toFixed(2)}</AliquotaIss>
            <CodigoTributacaoMunicipal>${data.servicoItemLista}</CodigoTributacaoMunicipal>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${data.prestadorCnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${data.prestadorInscricaoMunicipal}</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${data.tomadorCpfCnpj.length === 11 
                  ? `<Cpf>${data.tomadorCpfCnpj}</Cpf>` 
                  : `<Cnpj>${data.tomadorCpfCnpj}</Cnpj>`}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(data.tomadorRazaoSocial)}</RazaoSocial>
            <Endereco>
              <Logradouro>${escapeXml(data.tomadorLogradouro)}</Logradouro>
              <Numero>${data.tomadorNumero}</Numero>
              ${data.tomadorComplemento ? `<Complemento>${escapeXml(data.tomadorComplemento)}</Complemento>` : ''}
              <Bairro>${escapeXml(data.tomadorBairro)}</Bairro>
              <Cidade>${data.tomadorCidade}</Cidade>
              <Uf>${data.tomadorEstado}</Uf>
              <Cep>${data.tomadorCep}</Cep>
            </Endereco>
          </Tomador>
          ${data.observacoes ? `<Observacao>${escapeXml(data.observacoes)}</Observacao>` : ''}
        </InfRps>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}

/**
 * Formata uma data no padrão ISO 8601
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Escapa caracteres especiais para XML
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


/**
 * Gerador de PDF DANFE-Se
 */
import { PDFDocument, rgb } from 'pdf-lib';

export interface DanfsePdfData {
  nfseNumber: string;
  seriesNumber: string;
  emissionDate: string;
  verificationCode: string;
  
  prestadorName: string;
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  prestadorAddress: string;
  prestadorCity: string;
  prestadorState: string;
  prestadorCep: string;
  
  tomadorName: string;
  tomadorCpfCnpj: string;
  tomadorAddress: string;
  tomadorCity: string;
  tomadorState: string;
  tomadorCep: string;
  tomadorBairro: string;
  
  serviceDescription: string;
  serviceValue: number;
  issRate: number;
  issValue: number;
  deductions: number;
  discount: number;
  netValue: number;
  
  observations?: string;
}

/**
 * Gera PDF da DANFE-Se
 */
export async function generateDanfsePdf(data: DanfsePdfData): Promise<Buffer> {
  try {
    console.log('[DANFSE-PDF] Gerando PDF da DANFE-Se...');
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 20;
    let y = height - margin;
    
    // Cabeçalho
    page.drawText('DANFE-Se', {
      x: margin,
      y: y - 20,
      size: 24,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('Documento Auxiliar da Nota Fiscal de Serviço Eletrônica', {
      x: margin,
      y: y - 45,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    page.drawText(`NFS-e nº ${data.nfseNumber}`, {
      x: width - margin - 150,
      y: y - 20,
      size: 14,
      color: rgb(0, 0, 0),
    });
    
    page.drawText(`Data: ${data.emissionDate}`, {
      x: width - margin - 150,
      y: y - 45,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 70;
    
    // Linha divisória
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    
    // Prestador
    page.drawText('PRESTADOR DE SERVIÇO', {
      x: margin,
      y: y,
      size: 11,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    page.drawText(`Razão Social: ${data.prestadorName}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`CNPJ: ${formatCnpj(data.prestadorCnpj)}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Inscrição Municipal: ${data.prestadorInscricaoMunicipal}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Endereço: ${data.prestadorAddress}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`${data.prestadorCity}, ${data.prestadorState} - CEP: ${data.prestadorCep}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 25;
    
    // Linha divisória
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    
    // Tomador
    page.drawText('TOMADOR DE SERVIÇO', {
      x: margin,
      y: y,
      size: 11,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    page.drawText(`Razão Social: ${data.tomadorName}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`CPF/CNPJ: ${formatCpfCnpj(data.tomadorCpfCnpj)}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Endereço: ${data.tomadorAddress}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`${data.tomadorBairro}, ${data.tomadorCity}, ${data.tomadorState} - CEP: ${data.tomadorCep}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 25;
    
    // Linha divisória
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    
    // Serviço
    page.drawText('SERVIÇO PRESTADO', {
      x: margin,
      y: y,
      size: 11,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    page.drawText(`Descrição: ${data.serviceDescription}`, {
      x: margin,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 25;
    
    // Tabela de valores
    const colX1 = margin;
    const colX2 = margin + 300;
    
    page.drawText('Valor do Serviço:', {
      x: colX1,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    page.drawText(`R$ ${data.serviceValue.toFixed(2)}`, {
      x: colX2,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Deduções:`, {
      x: colX1,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    page.drawText(`R$ ${data.deductions.toFixed(2)}`, {
      x: colX2,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Desconto:`, {
      x: colX1,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    page.drawText(`R$ ${data.discount.toFixed(2)}`, {
      x: colX2,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Valor Líquido:`, {
      x: colX1,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    page.drawText(`R$ ${data.netValue.toFixed(2)}`, {
      x: colX2,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Alíquota ISS: ${data.issRate.toFixed(2)}%`, {
      x: colX1,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    page.drawText(`R$ ${data.issValue.toFixed(2)}`, {
      x: colX2,
      y: y,
      size: 10,
      color: rgb(0, 0, 0),
    });
    
    y -= 25;
    
    // Linha divisória
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 2,
      color: rgb(0, 0, 0),
    });
    
    y -= 20;
    
    // Total
    page.drawText('VALOR TOTAL DA NFS-e:', {
      x: colX1,
      y: y,
      size: 12,
      color: rgb(0, 0, 0),
    });
    page.drawText(`R$ ${(data.serviceValue - data.deductions - data.discount + data.issValue).toFixed(2)}`, {
      x: colX2,
      y: y,
      size: 12,
      color: rgb(0, 0, 0),
    });
    
    y -= 40;
    
    // Código de verificação
    page.drawText(`Código de Verificação: ${data.verificationCode}`, {
      x: margin,
      y: y,
      size: 9,
      color: rgb(0, 0, 0),
    });
    
    y -= 15;
    page.drawText(`Consulte esta NFS-e em: https://notadomilhao.sf.prefeitura.sp.gov.br`, {
      x: margin,
      y: y,
      size: 9,
      color: rgb(0, 0, 0),
    });
    
    const pdfBytes = await pdfDoc.save();
    console.log('[DANFSE-PDF] PDF gerado com sucesso!');
    
    return Buffer.from(pdfBytes);
  } catch (error: any) {
    console.error('[DANFSE-PDF] Erro ao gerar PDF:', error?.message);
    throw new Error(`Erro ao gerar DANFE-Se: ${error?.message}`);
  }
}

/**
 * Formata CNPJ
 */
function formatCnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF ou CNPJ
 */
function formatCpfCnpj(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  } else {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
}
