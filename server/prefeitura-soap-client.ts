import * as soap from 'soap';
import { createPrivateKey } from 'crypto';
import * as https from 'https';
import * as fs from 'fs';
import { signXml } from './xml-signer';

/**
 * Cliente SOAP para integração com Prefeitura de SP
 * Documentação: https://notadomilhao.sf.prefeitura.sp.gov.br/desenvolvedor/
 */

// URLs da Prefeitura de São Paulo para NFS-e
// Documentação: https://notadomilhao.sf.prefeitura.sp.gov.br/desenvolvedor/
// URLs da Prefeitura de SP - mesma URL para homolog e prod, diferença está no XML e credenciamento
const PREFEITURA_WSDL_URL = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx';
const SOAP_ACTION_ENVIAR = 'http://www.prefeitura.sp.gov.br/nfe/wsdl/RecepcionarLoteRps';
const SOAP_ACTION_CONSULTA = 'http://www.prefeitura.sp.gov.br/nfe/wsdl/ConsultaLote';
const SOAP_ACTION_CONSULTA_NFE = 'http://www.prefeitura.sp.gov.br/nfe/wsdl/ConsultaNFe';

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
  private certificatePem: string = '';
  private privateKeyPem: string = '';
  private httpsAgent: https.Agent | null = null;

  /**
   * Define certificado e chave privada
   */
  setCertificate(cert: string, key: string): void {
    this.certificatePem = cert;
    this.privateKeyPem = key;
    
    // Criar agent com certificado
    this.httpsAgent = new https.Agent({
      cert: this.certificatePem,
      key: this.privateKeyPem,
      rejectUnauthorized: false,
    });
  }

  /**
   * Inicializa o cliente SOAP com certificado digital
   */
  async initialize(): Promise<void> {
    try {
      if (!this.httpsAgent) {
        throw new Error('Certificado não foi configurado. Chame setCertificate() primeiro.');
      }

      console.log('[SOAP] Criando opções de cliente SOAP...');
      // Criar cliente SOAP com agent customizado
      const options: any = {
        disableCache: true,
        httpClient: {
          request: (rurl: string, opts: any, callback: any) => {
            console.log('[SOAP] Fazendo requisição HTTPS para:', rurl);
            // Garantir que opts existe e tem o agent
            const finalOpts = {
              ...opts,
              agent: this.httpsAgent,
              rejectUnauthorized: false,
            };
            try {
              const req = https.request(rurl, finalOpts, callback);
              req.on('error', (err: any) => {
                console.error('[SOAP] Erro na requisição HTTPS:', err?.message || err);
              });
              return req;
            } catch (err: any) {
              console.error('[SOAP] Erro ao criar requisição HTTPS:', err?.message || err);
              callback(err);
              return null as any;
            }
          },
        },
      };

      console.log('[SOAP] Chamando soap.createClientAsync...');
      this.soapClient = await soap.createClientAsync(PREFEITURA_WSDL_URL, options);
      console.log('[SOAP] Cliente SOAP criado com sucesso!');
    } catch (error: any) {
      console.error('[SOAP] Erro ao inicializar cliente:', error?.message || error);
      console.error('[SOAP] Stack trace:', error?.stack);
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
<PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.prefeitura.sp.gov.br/nfe http://www.prefeitura.sp.gov.br/nfe/schemas/PedidoEnvioLoteRPS.xsd">
  <Lote Id="L1">
  <RPS Id="R1">
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
</Lote>
</PedidoEnvioLoteRPS>`;
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
      console.log('[SOAP] Iniciando emissão de RPS...');
      
      // Configurar certificado
      this.setCertificate(certificatePem, privateKeyPem);
      
      // Inicializar cliente SOAP
      if (!this.soapClient) {
        console.log('[SOAP] Inicializando cliente SOAP...');
        await this.initialize();
      }

      // Gera XML do RPS
      console.log('[SOAP] Gerando XML do RPS...');
      const rpsXml = this.generateRpsXml(rpsData);

      // Assina o XML
      console.log('[SOAP] Assinando XML...');
      const signedXml = await signXml(rpsXml, privateKeyPem, certificatePem);

      // Chama método SOAP com timeout
      console.log('[SOAP] Chamando método RecepcionarLoteRps...');
      const result = await Promise.race([
        new Promise((resolve, reject) => {
          try {
            this.soapClient.RecepcionarLoteRps(
              { xml: signedXml },
              (err: any, result: any) => {
                if (err) {
                  console.error('[SOAP] Erro ao chamar RecepcionarLoteRps:', err?.message || err);
                  reject(err);
                } else {
                  console.log('[SOAP] Resposta recebida com sucesso');
                  resolve(result);
                }
              }
            );
          } catch (callErr: any) {
            console.error('[SOAP] Erro ao invocar método:', callErr?.message || callErr);
            reject(callErr);
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao conectar com Prefeitura (60s)')), 60000)
        )
      ]);


      // Processa resposta
      const resultData = result as any;
      if (resultData?.RecepcionarLoteRpsResult?.Sucesso) {
        console.log('[SOAP] RPS emitido com sucesso!');
        return {
          success: true,
          nfseNumber: resultData.RecepcionarLoteRpsResult.NfseNumber,
          protocol: resultData.RecepcionarLoteRpsResult.Protocol,
        };
      } else {
        const errorMsg = resultData?.RecepcionarLoteRpsResult?.Mensagem || 'Erro desconhecido ao emitir NFS-e';
        console.error('[SOAP] Erro na resposta:', errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error: any) {
      console.error('[SOAP] Exceção ao enviar RPS:', error?.message || error);
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

      const result = await new Promise((resolve, reject) => {
        this.soapClient.ConsultarNfse(
          { numero: nfseNumber },
          (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      const resultData = result as any;
      if (resultData?.ConsultarNfseResult?.Sucesso) {
        return {
          success: true,
          nfseData: resultData.ConsultarNfseResult,
        };
      } else {
        return {
          success: false,
          error: resultData?.ConsultarNfseResult?.Mensagem || 'Erro ao consultar NFS-e',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao consultar NFS-e: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Cancela NFS-e
   */
  async cancelarNfse(nfseNumber: string, motivo: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.soapClient) {
        await this.initialize();
      }

      const result = await new Promise((resolve, reject) => {
        this.soapClient.CancelarNfse(
          { numero: nfseNumber, motivo },
          (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      const resultData = result as any;
      if (resultData?.CancelarNfseResult?.Sucesso) {
        return { success: true };
      } else {
        return {
          success: false,
          error: resultData?.CancelarNfseResult?.Mensagem || 'Erro ao cancelar NFS-e',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao cancelar NFS-e: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }
}
