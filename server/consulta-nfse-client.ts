/**
 * Cliente para consulta de NFS-e na Prefeitura de São Paulo
 * Integração com WebService SOAP de Consulta
 */

import * as https from 'https';
import * as soap from 'soap';

export interface ConsultaNfseRequest {
  nfseNumber: string;
  prestadorCnpj: string;
  tomadorCpfCnpj: string;
  certificateContent: string;
  certificateKeyContent: string;
}

export interface ConsultaNfseResponse {
  success: boolean;
  nfseNumber?: string;
  status?: string;
  emissionDate?: string;
  verificationCode?: string;
  error?: string;
}

export class ConsultaNfseClient {
  private soapClient: any;
  private httpsAgent: https.Agent | null = null;
  private readonly WSDL_URL = 'https://nfe.prefeitura.sp.gov.br/ws/consultanfse.asmx?wsdl';

  /**
   * Configurar certificado digital
   */
  setCertificate(certificateContent: string, certificateKeyContent: string): void {
    try {
      console.log('[CONSULTA-NFSE] Configurando certificado...');

      // Criar https.Agent com certificado
      this.httpsAgent = new https.Agent({
        cert: certificateContent,
        key: certificateKeyContent,
        rejectUnauthorized: false, // Permitir certificados auto-assinados
      });

      console.log('[CONSULTA-NFSE] Certificado configurado com sucesso');
    } catch (error: any) {
      console.error('[CONSULTA-NFSE] Erro ao configurar certificado:', error?.message);
      throw error;
    }
  }

  /**
   * Inicializar cliente SOAP
   */
  async initialize(): Promise<void> {
    try {
      console.log('[CONSULTA-NFSE] Inicializando cliente SOAP...');

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
      console.log('[CONSULTA-NFSE] Cliente SOAP inicializado com sucesso');
    } catch (error: any) {
      console.error('[CONSULTA-NFSE] Erro ao inicializar cliente SOAP:', error?.message);
      throw error;
    }
  }

  /**
   * Consultar NFS-e na Prefeitura
   */
  async consultarNfse(request: ConsultaNfseRequest): Promise<ConsultaNfseResponse> {
    try {
      console.log('[CONSULTA-NFSE] Iniciando consulta de NFS-e...');

      // Configurar certificado
      this.setCertificate(request.certificateContent, request.certificateKeyContent);

      // Inicializar cliente SOAP
      await this.initialize();

      // Preparar dados da consulta
      const consultaXml = `
        <ConsultarNfseServicoPrestado>
          <Prestador>
            <Cnpj>${request.prestadorCnpj.replace(/\D/g, '')}</Cnpj>
          </Prestador>
          <NumeroNfse>${request.nfseNumber}</NumeroNfse>
        </ConsultarNfseServicoPrestado>
      `;

      console.log('[CONSULTA-NFSE] Enviando requisição para Prefeitura...');

      // Chamar método SOAP
      const result = await this.callSoapMethod('ConsultarNfseServicoPrestado', {
        nfseCabecMsg: '<cabecalho versao="2.04"><versaoDados>2.04</versaoDados></cabecalho>',
        nfseDadosMsg: consultaXml,
      });

      console.log('[CONSULTA-NFSE] Resposta recebida:', result);

      // Processar resposta
      if (result && result.ConsultarNfseServicoPrestadoResult) {
        const responseXml = result.ConsultarNfseServicoPrestadoResult;

        // Extrair informações da resposta
        const nfseMatch = responseXml.match(/<Numero>(\d+)<\/Numero>/);
        const statusMatch = responseXml.match(/<Status>(\d+)<\/Status>/);
        const dataMatch = responseXml.match(/<DataEmissao>([^<]+)<\/DataEmissao>/);
        const codigoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/);

        return {
          success: true,
          nfseNumber: nfseMatch ? nfseMatch[1] : request.nfseNumber,
          status: statusMatch ? this.mapStatus(statusMatch[1]) : 'unknown',
          emissionDate: dataMatch ? dataMatch[1] : undefined,
          verificationCode: codigoMatch ? codigoMatch[1] : undefined,
        };
      }

      return {
        success: false,
        error: 'Resposta inválida da Prefeitura',
      };
    } catch (error: any) {
      console.error('[CONSULTA-NFSE] Erro ao consultar NFS-e:', error?.message);
      return {
        success: false,
        error: error?.message || 'Erro ao consultar NFS-e',
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

  /**
   * Mapear status numérico para descrição
   */
  private mapStatus(statusCode: string): string {
    const statusMap: Record<string, string> = {
      '1': 'Ativa',
      '2': 'Cancelada',
      '3': 'Substituída',
      '4': 'Pendente',
    };

    return statusMap[statusCode] || 'Desconhecido';
  }
}
