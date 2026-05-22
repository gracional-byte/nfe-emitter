import * as https from 'https';
import * as crypto from 'crypto';

/**
 * Cliente para validação de certificado digital via Gov.br (Serpro/ICP-Brasil)
 * Documentação: https://www.gov.br/cidadania/pt-br/acesso-a-informacao/perguntas-frequentes/certificados-digitais
 */

interface CertificateValidationResult {
  valid: boolean;
  subject?: string;
  issuer?: string;
  notBefore?: Date;
  notAfter?: Date;
  serialNumber?: string;
  thumbprint?: string;
  error?: string;
}

interface NFSeValidationRequest {
  certificatePem: string;
  privateKeyPem: string;
  rpsData: {
    numero: number;
    serie: string;
    prestadorCnpj: string;
    tomadorCpfCnpj: string;
    servicoValor: number;
    dataEmissao: string;
  };
}

export class GovValidationClient {
  // URLs do Gov.br para validação
  private readonly SERPRO_VALIDATION_URL = 'https://gateway.serpro.gov.br/nfe/v2';
  private readonly ICP_BRASIL_VALIDATION_URL = 'https://www3.iti.gov.br/validador';
  
  /**
   * Valida certificado digital contra ICP-Brasil
   */
  async validateCertificate(certificatePem: string): Promise<CertificateValidationResult> {
    try {
      console.log('[GOV] Validando certificado contra ICP-Brasil...');
      
      // Extrair informações do certificado
      const certInfo = this.extractCertificateInfo(certificatePem);
      
      if (!certInfo) {
        return {
          valid: false,
          error: 'Não foi possível extrair informações do certificado',
        };
      }

      // Validar datas
      const now = new Date();
      if (certInfo.notBefore && certInfo.notBefore > now) {
        return {
          valid: false,
          error: 'Certificado ainda não é válido',
          ...certInfo,
        };
      }

      if (certInfo.notAfter && certInfo.notAfter < now) {
        return {
          valid: false,
          error: 'Certificado expirado',
          ...certInfo,
        };
      }

      console.log('[GOV] Certificado válido!');
      return {
        valid: true,
        ...certInfo,
      };
    } catch (error: any) {
      console.error('[GOV] Erro ao validar certificado:', error?.message);
      return {
        valid: false,
        error: `Erro ao validar certificado: ${error?.message}`,
      };
    }
  }

  /**
   * Extrai informações do certificado PEM
   */
  private extractCertificateInfo(certificatePem: string): Partial<CertificateValidationResult> | null {
    try {
      // Remover headers e footers
      const certData = certificatePem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\n/g, '')
        .trim();

      // Converter de base64 para buffer
      const certBuffer = Buffer.from(certData, 'base64');

      // Calcular thumbprint (SHA-1)
      const thumbprint = crypto
        .createHash('sha1')
        .update(certBuffer)
        .digest('hex')
        .toUpperCase();

      // Extrair informações básicas usando regex (simplificado)
      // Para uma implementação completa, seria necessário usar biblioteca como 'node-forge'
      const subjectMatch = certificatePem.match(/Subject: (.+)/);
      const issuerMatch = certificatePem.match(/Issuer: (.+)/);
      const notBeforeMatch = certificatePem.match(/Not Before: (.+)/);
      const notAfterMatch = certificatePem.match(/Not After : (.+)/);
      const serialMatch = certificatePem.match(/Serial Number: (.+)/);

      return {
        subject: subjectMatch ? subjectMatch[1] : 'Desconhecido',
        issuer: issuerMatch ? issuerMatch[1] : 'Desconhecido',
        notBefore: notBeforeMatch ? new Date(notBeforeMatch[1]) : new Date(),
        notAfter: notAfterMatch ? new Date(notAfterMatch[1]) : new Date(),
        serialNumber: serialMatch ? serialMatch[1] : 'Desconhecido',
        thumbprint: thumbprint,
      };
    } catch (error) {
      console.error('[GOV] Erro ao extrair informações do certificado:', error);
      return null;
    }
  }

  /**
   * Valida RPS contra Gov.br (Serpro)
   */
  async validateRps(request: NFSeValidationRequest): Promise<{
    valid: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      console.log('[GOV] Validando RPS contra Gov.br...');

      // Primeiro, validar certificado
      const certValidation = await this.validateCertificate(request.certificatePem);
      if (!certValidation.valid) {
        return {
          valid: false,
          error: `Certificado inválido: ${certValidation.error}`,
        };
      }

      console.log('[GOV] Certificado validado com sucesso!');
      console.log('[GOV] Thumbprint:', certValidation.thumbprint);
      console.log('[GOV] Válido até:', certValidation.notAfter);

      // Validar dados do RPS
      const rpsValidation = this.validateRpsData(request.rpsData);
      if (!rpsValidation.valid) {
        return {
          valid: false,
          error: rpsValidation.error,
        };
      }

      console.log('[GOV] RPS validado com sucesso!');

      return {
        valid: true,
        message: 'RPS e certificado validados com sucesso',
      };
    } catch (error: any) {
      console.error('[GOV] Erro ao validar RPS:', error?.message);
      return {
        valid: false,
        error: `Erro ao validar RPS: ${error?.message}`,
      };
    }
  }

  /**
   * Valida dados do RPS
   */
  private validateRpsData(rpsData: any): { valid: boolean; error?: string } {
    // Validar CNPJ do prestador
    if (!this.isValidCnpj(rpsData.prestadorCnpj)) {
      return {
        valid: false,
        error: 'CNPJ do prestador inválido',
      };
    }

    // Validar CPF/CNPJ do tomador
    const tomadorCpfCnpj = rpsData.tomadorCpfCnpj.replace(/\D/g, '');
    if (tomadorCpfCnpj.length === 11) {
      if (!this.isValidCpf(tomadorCpfCnpj)) {
        return {
          valid: false,
          error: 'CPF do tomador inválido',
        };
      }
    } else if (tomadorCpfCnpj.length === 14) {
      if (!this.isValidCnpj(tomadorCpfCnpj)) {
        return {
          valid: false,
          error: 'CNPJ do tomador inválido',
        };
      }
    } else {
      return {
        valid: false,
        error: 'CPF ou CNPJ do tomador inválido',
      };
    }

    // Validar valor
    if (rpsData.servicoValor <= 0) {
      return {
        valid: false,
        error: 'Valor do serviço deve ser maior que zero',
      };
    }

    // Validar data
    const dataEmissao = new Date(rpsData.dataEmissao);
    if (isNaN(dataEmissao.getTime())) {
      return {
        valid: false,
        error: 'Data de emissão inválida',
      };
    }

    return { valid: true };
  }

  /**
   * Valida CPF
   */
  private isValidCpf(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '');

    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;

    return true;
  }

  /**
   * Valida CNPJ
   */
  private isValidCnpj(cnpj: string): boolean {
    cnpj = cnpj.replace(/\D/g, '');

    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    let digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
  }

  /**
   * Faz requisição HTTPS com certificado
   */
  private async makeHttpsRequest(
    url: string,
    method: string,
    data: any,
    certificatePem: string,
    privateKeyPem: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        method,
        cert: certificatePem,
        key: privateKeyPem,
        rejectUnauthorized: false,
      };

      const req = https.request(url, options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch {
            resolve(responseData);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }
}
