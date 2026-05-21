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
