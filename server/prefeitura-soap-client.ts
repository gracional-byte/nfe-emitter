import * as soap from 'soap';
import { createPrivateKey } from 'crypto';
import * as https from 'https';
import * as fs from 'fs';
import { signXml } from './xml-signer';

/**
 * Cliente SOAP para integração com Prefeitura de SP
 * Documentação: https://notadomilhao.sf.prefeitura.sp.gov.br/desenvolvedor/
 * 
 * Melhorias implementadas:
 * - Timeout aumentado para 60s
 * - Retry com backoff exponencial
 * - TLS 1.2+ obrigatório
 * - Melhor tratamento de erros
 * - Logs detalhados
 */

// URLs da Prefeitura de São Paulo para NFS-e
const PREFEITURA_WSDL_URL = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx';
const SOAP_ACTION_ENVIAR = 'http://www.prefeitura.sp.gov.br/nfe/wsdl/RecepcionarLoteRps';
const SOAP_ACTION_CONSULTA = 'http://www.prefeitura.sp.gov.br/nfe/wsdl/ConsultaLote';
const SOAP_ACTION_CONSULTA_NFE = 'http://www.prefeitura.sp.gov.br/nfe/wsdl/ConsultaNFe';

// Configurações de retry e timeout
const SOAP_CONFIG = {
  TIMEOUT_MS: 60000, // 60 segundos
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1000, // 1 segundo
  BACKOFF_MULTIPLIER: 2,
  TLS_MIN_VERSION: 'TLSv1.2',
};

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

interface SoapCallResult {
  success: boolean;
  nfseNumber?: string;
  protocol?: string;
  error?: string;
  retries?: number;
  lastError?: string;
}

/**
 * Helper para retry com backoff exponencial
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = SOAP_CONFIG.MAX_RETRIES,
  initialDelay: number = SOAP_CONFIG.INITIAL_RETRY_DELAY_MS,
  operationName: string = 'Operação'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[SOAP] ${operationName} - Tentativa ${attempt + 1}/${maxRetries}`);
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      const isLastAttempt = attempt === maxRetries - 1;

      console.error(
        `[SOAP] ${operationName} falhou na tentativa ${attempt + 1}:`,
        error?.message || error
      );
      console.log(`[SOAP] Erro retentável: ${isRetryable}, Última tentativa: ${isLastAttempt}`);

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Calcular delay com backoff exponencial
      const delay = initialDelay * Math.pow(SOAP_CONFIG.BACKOFF_MULTIPLIER, attempt);
      console.log(`[SOAP] Aguardando ${delay}ms antes de nova tentativa...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error(`${operationName} falhou após ${maxRetries} tentativas`);
}

/**
 * Verifica se um erro é retentável
 */
function isRetryableError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code?.toLowerCase() || '';

  // Erros retentáveis
  const retryablePatterns = [
    'econnreset',
    'socket hang up',
    'timeout',
    'econnrefused',
    'etimedout',
    'ehostunreach',
    'enetunreach',
    'enotfound',
    'temporarily unavailable',
    'service unavailable',
  ];

  return retryablePatterns.some(
    (pattern) => message.includes(pattern) || code.includes(pattern)
  );
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

    // Criar agent com certificado e TLS 1.2+
    this.httpsAgent = new https.Agent({
      cert: this.certificatePem,
      key: this.privateKeyPem,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2' as any,
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: SOAP_CONFIG.TIMEOUT_MS,
    });

    console.log('[SOAP] Certificado configurado com TLS 1.2+');
  }

  /**
   * Inicializa o cliente SOAP com certificado digital
   */
  async initialize(): Promise<void> {
    return retryWithBackoff(
      async () => {
        if (!this.httpsAgent) {
          throw new Error('Certificado não foi configurado. Chame setCertificate() primeiro.');
        }

        console.log('[SOAP] Criando opções de cliente SOAP...');

        const options: any = {
          disableCache: true,
          timeout: SOAP_CONFIG.TIMEOUT_MS,
          httpClient: {
            request: (rurl: string, opts: any, callback: any) => {
              console.log('[SOAP] Fazendo requisição HTTPS para:', rurl);

              const finalOpts = {
                ...opts,
                agent: this.httpsAgent,
                rejectUnauthorized: false,
                timeout: SOAP_CONFIG.TIMEOUT_MS,
              };

              try {
                const req = https.request(rurl, finalOpts, (res) => {
                  console.log(`[SOAP] Status da resposta: ${res.statusCode}`);
                  callback(null, res);
                });

                req.on('error', (err: any) => {
                  console.error('[SOAP] Erro na requisição HTTPS:', err?.message || err);
                });

                req.on('timeout', () => {
                  console.error('[SOAP] Timeout na requisição HTTPS');
                  req.destroy();
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
      },
      SOAP_CONFIG.MAX_RETRIES,
      SOAP_CONFIG.INITIAL_RETRY_DELAY_MS,
      'Inicialização do cliente SOAP'
    );
  }

  /**
   * Gera XML do RPS conforme padrão Prefeitura SP (formato correto do Gov)
   */
  private generateRpsXml(rpsData: RpsData): string {
    const now = new Date();
    const dhEmi = now.toISOString().replace('Z', '-03:00');
    const dCompet = rpsData.dataEmissao;

    const servicoValor = rpsData.servicoValor.toFixed(2);
    const issAliquota = rpsData.issAliquota.toFixed(2);
    const issValor = (rpsData.servicoValor * rpsData.issAliquota / 100).toFixed(2);
    const deducoes = (rpsData.deducoes || 0).toFixed(2);
    const desconto = (rpsData.desconto || 0).toFixed(2);
    const vLiq = (rpsData.servicoValor - parseFloat(deducoes) - parseFloat(desconto)).toFixed(2);

    // ID único para a NFSe
    const nfseId = `NFS${rpsData.prestadorCnpj}${rpsData.numero.toString().padStart(12, '0')}`;
    const dpsId = `DPS${rpsData.prestadorCnpj}${rpsData.numero.toString().padStart(12, '0')}`;

    return `<?xml version="1.0" encoding="utf-8"?><NFSe xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="${nfseId}"><xLocEmi>São Paulo</xLocEmi><xLocPrestacao>São Paulo</xLocPrestacao><nNFSe>${rpsData.numero}</nNFSe><cLocIncid>3550308</cLocIncid><xTribNac>${rpsData.servicoDescricao}</xTribNac><verAplic>1.1.2</verAplic><ambGer>1</ambGer><tpEmis>2</tpEmis><cStat>100</cStat><dhProc>${dhEmi}</dhProc><nDFSe>${rpsData.numero}</nDFSe><emit><CNPJ>${rpsData.prestadorCnpj}</CNPJ><IM>${rpsData.prestadorInscricaoMunicipal}</IM><xNome>VIBE TERAPIAS INTEGRATIVAS LTDA</xNome><enderNac><xLgr>PAIS LEME</xLgr><nro>215</nro><xCpl>SALA 1518 E 1519</xCpl><xBairro>PINHEIROS</xBairro><cMun>3550308</cMun><UF>SP</UF><CEP>05424150</CEP></enderNac><email>erick_eches@hotmail.com</email></emit><valores><vBC>${servicoValor}</vBC><pAliqAplic>${issAliquota}</pAliqAplic><vISSQN>${issValor}</vISSQN><vLiq>${vLiq}</vLiq></valores><DPS versao="1.01"><infDPS Id="${dpsId}"><tpAmb>1</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>1.1.2</verAplic><serie>${rpsData.serie}</serie><nDPS>${rpsData.numero}</nDPS><dCompet>${dCompet}</dCompet><tpEmit>1</tpEmit><cLocEmi>3550308</cLocEmi><prest><CNPJ>${rpsData.prestadorCnpj}</CNPJ><IM>${rpsData.prestadorInscricaoMunicipal}</IM><email>erick_eches@hotmail.com</email><regTrib><opSimpNac>1</opSimpNac><regEspTrib>0</regEspTrib></regTrib></prest><toma><CPF>${rpsData.tomadorCpfCnpj}</CPF><xNome>${rpsData.tomadorRazaoSocial}</xNome><end><endNac><cMun>3550308</cMun><CEP>${rpsData.tomadorCep}</CEP></endNac><xLgr>${rpsData.tomadorLogradouro}</xLgr><nro>${rpsData.tomadorNumero}</nro><xBairro>${rpsData.tomadorBairro}</xBairro></end><email>cliente@example.com</email></toma><serv><locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest><cServ><cTribNac>040901</cTribNac><cTribMun>001</cTribMun><xDescServ>${rpsData.servicoDescricao}</xDescServ><cNBS>999999999</cNBS></cServ></serv><valores><vServPrest><vServ>${servicoValor}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN><pAliq>${issAliquota}</pAliq></tribMun><totTrib><vTotTrib><vTotTribFed>0.00</vTotTribFed><vTotTribEst>0.00</vTotTribEst><vTotTribMun>${issValor}</vTotTribMun></vTotTrib></totTrib></trib></valores></infDPS></DPS></infNFSe>`;
  }

  /**
   * Envia RPS para emissão de NFS-e com retry automático
   */
  async enviarRps(
    rpsData: RpsData,
    certificatePem: string,
    privateKeyPem: string
  ): Promise<SoapCallResult> {
    try {
      console.log('[SOAP] Iniciando emissão de RPS...');

      // Configurar certificado
      this.setCertificate(certificatePem, privateKeyPem);

      // Inicializar cliente SOAP (com retry)
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

      // Chama método SOAP com retry e timeout
      let retryCount = 0;
      const result = await retryWithBackoff(
        async () => {
          retryCount++;
          return new Promise<any>((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
              reject(new Error(`Timeout ao conectar com Prefeitura (${SOAP_CONFIG.TIMEOUT_MS}ms)`));
            }, SOAP_CONFIG.TIMEOUT_MS);

            try {
              this.soapClient.RecepcionarLoteRps(
                { xml: signedXml },
                (err: any, result: any) => {
                  clearTimeout(timeoutHandle);
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
              clearTimeout(timeoutHandle);
              console.error('[SOAP] Erro ao invocar método:', callErr?.message || callErr);
              reject(callErr);
            }
          });
        },
        SOAP_CONFIG.MAX_RETRIES,
        SOAP_CONFIG.INITIAL_RETRY_DELAY_MS,
        'Emissão de RPS'
      );

      // Processa resposta
      const resultData = result as any;
      if (resultData?.RecepcionarLoteRpsResult?.Sucesso) {
        console.log('[SOAP] RPS emitido com sucesso!');
        return {
          success: true,
          nfseNumber: resultData.RecepcionarLoteRpsResult.NfseNumber,
          protocol: resultData.RecepcionarLoteRpsResult.Protocol,
          retries: retryCount - 1,
        };
      } else {
        const errorMsg = resultData?.RecepcionarLoteRpsResult?.Mensagem || 'Erro desconhecido ao emitir NFS-e';
        console.error('[SOAP] Erro na resposta:', errorMsg);
        return {
          success: false,
          error: errorMsg,
          retries: retryCount - 1,
        };
      }
    } catch (error: any) {
      console.error('[SOAP] Exceção ao enviar RPS:', error?.message || error);
      console.error('[SOAP] Stack trace:', error?.stack);
      return {
        success: false,
        error: `Falha ao enviar RPS: ${error?.message || 'Erro desconhecido'}`,
        lastError: error?.message,
      };
    }
  }

  /**
   * Consulta NFS-e emitida com retry automático
   */
  async consultarNfse(nfseNumber: string): Promise<{
    success: boolean;
    nfseData?: any;
    error?: string;
    retries?: number;
  }> {
    try {
      if (!this.soapClient) {
        await this.initialize();
      }

      let retryCount = 0;
      const result = await retryWithBackoff(
        async () => {
          retryCount++;
          return new Promise<any>((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
              reject(new Error(`Timeout ao consultar NFS-e (${SOAP_CONFIG.TIMEOUT_MS}ms)`));
            }, SOAP_CONFIG.TIMEOUT_MS);

            this.soapClient.ConsultarNfse(
              { numero: nfseNumber },
              (err: any, result: any) => {
                clearTimeout(timeoutHandle);
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
        },
        SOAP_CONFIG.MAX_RETRIES,
        SOAP_CONFIG.INITIAL_RETRY_DELAY_MS,
        'Consulta de NFS-e'
      );

      const resultData = result as any;
      if (resultData?.ConsultarNfseResult?.Sucesso) {
        return {
          success: true,
          nfseData: resultData.ConsultarNfseResult,
          retries: retryCount - 1,
        };
      } else {
        return {
          success: false,
          error: resultData?.ConsultarNfseResult?.Mensagem || 'Erro ao consultar NFS-e',
          retries: retryCount - 1,
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
   * Cancela NFS-e com retry automático
   */
  async cancelarNfse(nfseNumber: string, motivo: string): Promise<{
    success: boolean;
    error?: string;
    retries?: number;
  }> {
    try {
      if (!this.soapClient) {
        await this.initialize();
      }

      let retryCount = 0;
      const result = await retryWithBackoff(
        async () => {
          retryCount++;
          return new Promise<any>((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
              reject(new Error(`Timeout ao cancelar NFS-e (${SOAP_CONFIG.TIMEOUT_MS}ms)`));
            }, SOAP_CONFIG.TIMEOUT_MS);

            this.soapClient.CancelarNfse(
              { numero: nfseNumber, motivo },
              (err: any, result: any) => {
                clearTimeout(timeoutHandle);
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
        },
        SOAP_CONFIG.MAX_RETRIES,
        SOAP_CONFIG.INITIAL_RETRY_DELAY_MS,
        'Cancelamento de NFS-e'
      );

      const resultData = result as any;
      if (resultData?.CancelarNfseResult?.Sucesso) {
        return {
          success: true,
          retries: retryCount - 1,
        };
      } else {
        return {
          success: false,
          error: resultData?.CancelarNfseResult?.Mensagem || 'Erro ao cancelar NFS-e',
          retries: retryCount - 1,
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
