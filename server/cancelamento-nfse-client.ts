/**
 * Cliente para cancelamento de NFS-e na Prefeitura de São Paulo
 * Integração com WebService SOAP de Cancelamento
 */

import * as https from 'https';
import * as soap from 'soap';

export interface CancelamentoNfseRequest {
  nfseNumber: string;
  prestadorCnpj: string;
  inscricaoMunicipal: string;
  justificativa: string;
  certificateContent: string;
  certificateKeyContent: string;
}

export interface CancelamentoNfseResponse {
  success: boolean;
  nfseNumber?: string;
  cancelmentDate?: string;
  protocolNumber?: string;
  error?: string;
}

export class CancelamentoNfseClient {
  private soapClient: any;
  private httpsAgent: https.Agent | null = null;
  private readonly WSDL_URL = 'https://nfe.prefeitura.sp.gov.br/ws/cancelarnfse.asmx?wsdl';

  /**
   * Configurar certificado digital
   */
  setCertificate(certificateContent: string, certificateKeyContent: string): void {
    try {
      console.log('[CANCELAMENTO-NFSE] Configurando certificado...');

      // Criar https.Agent com certificado
      this.httpsAgent = new https.Agent({
        cert: certificateContent,
        key: certificateKeyContent,
        rejectUnauthorized: false, // Permitir certificados auto-assinados
      });

      console.log('[CANCELAMENTO-NFSE] Certificado configurado com sucesso');
    } catch (error: any) {
      console.error('[CANCELAMENTO-NFSE] Erro ao configurar certificado:', error?.message);
      throw error;
    }
  }

  /**
   * Inicializar cliente SOAP
   */
  async initialize(): Promise<void> {
    try {
      console.log('[CANCELAMENTO-NFSE] Inicializando cliente SOAP...');

      if (!this.httpsAgent) {
        throw new Error('Certificado não foi configurado. Chame setCertificate() primeiro.');
      }

      // Opções do cliente SOAP
      const options = {
        httpClient: {
          request: (rurl: string, opts: any, callback: any) => {
            if (!opts) opts = {};
            opts.agent = this.httpsAgent;
            return https.request(rurl, opts, callback);
          },
        },
        wsdl_options: {
          httpClient: {
            request: (rurl: string, opts: any, callback: any) => {
              if (!opts) opts = {};
              opts.agent = this.httpsAgent;
              return https.request(rurl, opts, callback);
            },
          },
        },
      };

      // Criar cliente SOAP
      this.soapClient = await soap.createClientAsync(this.WSDL_URL, options);
      console.log('[CANCELAMENTO-NFSE] Cliente SOAP inicializado com sucesso');
    } catch (error: any) {
      console.error('[CANCELAMENTO-NFSE] Erro ao inicializar cliente SOAP:', error?.message);
      throw error;
    }
  }

  /**
   * Cancelar NFS-e na Prefeitura
   */
  async cancelarNfse(request: CancelamentoNfseRequest): Promise<CancelamentoNfseResponse> {
    try {
      console.log('[CANCELAMENTO-NFSE] Iniciando cancelamento de NFS-e...');

      // Configurar certificado
      this.setCertificate(request.certificateContent, request.certificateKeyContent);

      // Inicializar cliente SOAP
      await this.initialize();

      // Preparar dados do cancelamento
      const cancelamentoXml = `
        <CancelarNfse>
          <Prestador>
            <Cnpj>${request.prestadorCnpj.replace(/\D/g, '')}</Cnpj>
            <InscricaoMunicipal>${request.inscricaoMunicipal}</InscricaoMunicipal>
          </Prestador>
          <NumeroNfse>${request.nfseNumber}</NumeroNfse>
          <MotivoCancelamento>
            <Codigo>1</Codigo>
            <Descricao>${request.justificativa}</Descricao>
          </MotivoCancelamento>
        </CancelarNfse>
      `;

      console.log('[CANCELAMENTO-NFSE] Enviando requisição para Prefeitura...');

      // Chamar método SOAP
      const result = await this.callSoapMethod('CancelarNfse', {
        nfseCabecMsg: '<cabecalho versao="2.04"><versaoDados>2.04</versaoDados></cabecalho>',
        nfseDadosMsg: cancelamentoXml,
      });

      console.log('[CANCELAMENTO-NFSE] Resposta recebida:', result);

      // Processar resposta
      if (result && result.CancelarNfseResult) {
        const responseXml = result.CancelarNfseResult;

        // Extrair informações da resposta
        const nfseMatch = responseXml.match(/<NumeroNfse>(\d+)<\/NumeroNfse>/);
        const dataMatch = responseXml.match(/<DataCancelamento>([^<]+)<\/DataCancelamento>/);
        const protocolMatch = responseXml.match(/<NumeroPedidoCancelamento>([^<]+)<\/NumeroPedidoCancelamento>/);

        return {
          success: true,
          nfseNumber: nfseMatch ? nfseMatch[1] : request.nfseNumber,
          cancelmentDate: dataMatch ? dataMatch[1] : new Date().toISOString(),
          protocolNumber: protocolMatch ? protocolMatch[1] : undefined,
        };
      }

      return {
        success: false,
        error: 'Resposta inválida da Prefeitura',
      };
    } catch (error: any) {
      console.error('[CANCELAMENTO-NFSE] Erro ao cancelar NFS-e:', error?.message);
      return {
        success: false,
        error: error?.message || 'Erro ao cancelar NFS-e',
      };
    }
  }

  /**
   * Chamar método SOAP com tratamento de erro
   */
  private async callSoapMethod(method: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout na requisição SOAP (60 segundos)'));
      }, 60000);

      try {
        this.soapClient[method](args, (err: any, result: any) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}
