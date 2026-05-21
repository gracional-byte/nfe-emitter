import * as soap from 'soap';
import { createPrivateKey } from 'crypto';
import { signXml } from './xml-signer';

/**
 * Cliente SOAP para integração com Prefeitura de SP
 * Documentação: https://notadomilhao.sf.prefeitura.sp.gov.br/desenvolvedor/
 */

const PREFEITURA_WSDL_PROD = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx?wsdl';
const PREFEITURA_WSDL_TEST = 'https://homolog.prefeitura.sp.gov.br/ws/lotenfe.asmx?wsdl';

interface RpsData {
  numero: number;
  serie: string;
  tipo: number; // 1 = RPS, 2 = RPS Substituto, 3 = RPS Cancelado
  dataEmissao: string; // YYYY-MM-DD
  statusRps: string; // 'N' = Normal, 'C' = Cancelado
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  tomadorCpfCnpj: string;
  tomadorRazaoSocial: string;
  tomadorLogradouro: string;
  tomadorNumero: string;
  tomadorComplemento?: string;
  tomadorBairro: string;
  tomadorCidade: string;
  tomadorEstado: string;
  tomadorCep: string;
  servicoDescricao: string;
  servicoValor: number;
  servicoItemLista: string; // Código da lista de serviço
  deducoes?: number;
  desconto?: number;
  issRetido: string; // 'S' ou 'N'
  issAliquota: number;
  dataFato: string; // YYYY-MM-DD
  observacoes?: string;
}

export class PrefeituraSoapClient {
  private soapClient: any;
  private isProduction: boolean;

  constructor(isProduction: boolean = false) {
    this.isProduction = isProduction;
  }

  /**
   * Inicializa o cliente SOAP
   */
  async initialize(): Promise<void> {
    try {
      const wsdlUrl = this.isProduction ? PREFEITURA_WSDL_PROD : PREFEITURA_WSDL_TEST;
      this.soapClient = await soap.createClientAsync(wsdlUrl, {
        disableCache: true,
      });
    } catch (error: any) {
      throw new Error(`Falha ao conectar com WebService da Prefeitura: ${error?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Gera XML de RPS conforme padrão da Prefeitura
   */
  private generateRpsXml(rpsData: RpsData): string {
    const issAliquota = (rpsData.issAliquota * 100).toFixed(0);
    const servicoValor = rpsData.servicoValor.toFixed(2);
    const deducoes = (rpsData.deducoes || 0).toFixed(2);
    const desconto = (rpsData.desconto || 0).toFixed(2);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Lote>
  <RPS>
    <Numero>${rpsData.numero}</Numero>
    <Serie>${rpsData.serie}</Serie>
    <Tipo>${rpsData.tipo}</Tipo>
    <DataEmissao>${rpsData.dataEmissao}</DataEmissao>
    <StatusRps>${rpsData.statusRps}</StatusRps>
    <Prestador>
      <CNPJ>${rpsData.prestadorCnpj}</CNPJ>
      <InscricaoMunicipal>${rpsData.prestadorInscricaoMunicipal}</InscricaoMunicipal>
    </Prestador>
    <Tomador>
      <CpfCnpj>
        <Cnpj>${rpsData.tomadorCpfCnpj}</Cnpj>
      </CpfCnpj>
      <RazaoSocial>${rpsData.tomadorRazaoSocial}</RazaoSocial>
      <Endereco>
        <Logradouro>${rpsData.tomadorLogradouro}</Logradouro>
        <Numero>${rpsData.tomadorNumero}</Numero>
        ${rpsData.tomadorComplemento ? `<Complemento>${rpsData.tomadorComplemento}</Complemento>` : ''}
        <Bairro>${rpsData.tomadorBairro}</Bairro>
        <Cidade>${rpsData.tomadorCidade}</Cidade>
        <Estado>${rpsData.tomadorEstado}</Estado>
        <CEP>${rpsData.tomadorCep}</CEP>
      </Endereco>
    </Tomador>
    <Servico>
      <Descricao>${rpsData.servicoDescricao}</Descricao>
      <Valor>${servicoValor}</Valor>
      <ItemListaServico>${rpsData.servicoItemLista}</ItemListaServico>
      <Deducoes>${deducoes}</Deducoes>
      <Desconto>${desconto}</Desconto>
      <IssRetido>${rpsData.issRetido}</IssRetido>
      <Aliquota>${issAliquota}</Aliquota>
    </Servico>
    <DataFato>${rpsData.dataFato}</DataFato>
    ${rpsData.observacoes ? `<Observacoes>${rpsData.observacoes}</Observacoes>` : ''}
  </RPS>
</Lote>`;
  }

  /**
   * Envia RPS para emissão de NFS-e
   */
  async enviarRps(
    rpsData: RpsData,
    certificatePem: string,
    privateKeyPem: string
  ): Promise<{
    success: boolean;
    nfseNumber?: string;
    protocol?: string;
    error?: string;
  }> {
    try {
      if (!this.soapClient) {
        await this.initialize();
      }

      // Gera XML do RPS
      const rpsXml = this.generateRpsXml(rpsData);

      // Assina o XML
      const signedXml = await signXml(rpsXml, privateKeyPem, certificatePem);

      // Chama método SOAP
      const result = await this.callSoapMethod('EnviarRps', {
        xml: signedXml,
      });

      // Processa resposta
      if (result.Sucesso) {
        return {
          success: true,
          nfseNumber: result.NfseNumber,
          protocol: result.Protocol,
        };
      } else {
        return {
          success: false,
          error: result.Mensagem || 'Erro desconhecido ao emitir NFS-e',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao enviar RPS: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Consulta NFS-e emitida
   */
  async consultarNfse(nfseNumber: string): Promise<{
    success: boolean;
    nfseData?: any;
    error?: string;
  }> {
    try {
      if (!this.soapClient) {
        await this.initialize();
      }

      const result = await this.callSoapMethod('ConsultarNfse', {
        numero: nfseNumber,
      });

      if (result.Sucesso) {
        return {
          success: true,
          nfseData: result,
        };
      } else {
        return {
          success: false,
          error: result.Mensagem || 'NFS-e não encontrada',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Erro ao consultar NFS-e: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Cancela NFS-e
   */
  async cancelarNfse(
    nfseNumber: string,
    motivo: string,
    privateKeyPem: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.soapClient) {
        await this.initialize();
      }

      const cancelXml = `<?xml version="1.0" encoding="UTF-8"?>
<Cancelamento>
  <NfseNumber>${nfseNumber}</NfseNumber>
  <Motivo>${motivo}</Motivo>
</Cancelamento>`;

      const signedXml = await signXml(cancelXml, privateKeyPem, certificatePem);const result = await this.callSoapMethod('CancelarNfse', {
        xml: signedXml,
      });

      if (result.Sucesso) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.Mensagem || 'Erro ao cancelar NFS-e',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Erro ao cancelar NFS-e: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Chama método SOAP genérico
   */
  private async callSoapMethod(methodName: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const method = this.soapClient[methodName];
      if (!method) {
        reject(new Error(`Método SOAP ${methodName} não encontrado`));
        return;
      }

      method(params, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }
}
