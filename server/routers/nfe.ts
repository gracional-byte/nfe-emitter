import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as forge from 'node-forge';
import {
  getCompanyConfig,
  upsertCompanyConfig,
  getActiveCertificate,
  getCertificatesByUser,
  createCertificate,
  createInvoice,
  getInvoicesByUser,
  getInvoiceStats,
  createAuditLog,
  updateInvoice,
} from '../db';
import { emitNfse, consultarNfse, cancelarNfse } from '../nfse-service';
import { storagePut, storageGet } from '../storage';
import { notifyOwner } from '../_core/notification';
import { validateCpfOrCnpj, generateThumbprint } from '../nfe-service';
import { PrefeituraSoapClient } from '../prefeitura-soap-client';
import { extractCertificateInfo } from '../certificate-utils';

const CompanyConfigSchema = z.object({
  cnpj: z.string().min(14).max(14),
  inscricaoMunicipal: z.string(),
  itemListaServico: z.string(),
  codigoCnae: z.string(),
  regimeEspecialTributacao: z.string().optional(),
  optanteSimplesNacional: z.string().default('1'),
  incentivadorCultural: z.string().default('2'),
});

const CertificateUploadSchema = z.object({
  certificateName: z.string(),
  certificateContent: z.string(), // Base64 do arquivo .pfx ou conteúdo PEM
  certificatePassword: z.string().optional(), // Senha do .pfx
  fileType: z.enum(['pfx', 'pem']).default('pem'), // Tipo de arquivo
  privateKey: z.string().optional(), // Chave privada em PEM (quando upload separado)
});

const EmitDanfseSchema = z.object({
  clientName: z.string(),
  clientCpfCnpj: z.string(),
  clientAddress: z.string(),
  clientCity: z.string(),
  clientState: z.string(),
  clientCep: z.string(),
  clientBairro: z.string(),
  serviceDescription: z.string(),
  serviceValue: z.number().positive(),
  issRate: z.number().default(5),
  deductions: z.number().optional().default(0),
  discount: z.number().optional().default(0),
  observations: z.string().optional(),
  certificateId: z.number(),
});

/**
 * Extrair certificado e chave privada de arquivo .pfx
 */
async function extractCertificateFromPfx(
  pfxBase64: string,
  password: string
): Promise<{ certificate: string; privateKey: string }> {
  try {
    // Decodificar Base64
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');
    
    // Converter buffer para string binária corretamente
    let binaryString = '';
    for (let i = 0; i < pfxBuffer.length; i++) {
      binaryString += String.fromCharCode(pfxBuffer[i]);
    }
    
    // Carregar o .pfx
    const p12Asn1 = forge.asn1.fromDer(binaryString);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    // Extrair certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    if (!certBags.certBag || certBags.certBag.length === 0) {
      throw new Error('Nenhum certificado encontrado no arquivo .pfx');
    }

    const cert = certBags.certBag[0].cert;
    const certificatePem = forge.pki.certificateToPem(cert);

    // Extrair chave privada - tentar ambos os tipos de bag
    let key = null;
    
    // Primeiro tenta PKCS8 shrouded
    const keyBags8 = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    if (keyBags8.pkcs8ShroudedKeyBag && keyBags8.pkcs8ShroudedKeyBag.length > 0) {
      key = keyBags8.pkcs8ShroudedKeyBag[0].key;
    } else {
      // Se não encontrar, tenta RSA key bag
      const keyBagsRsa = p12.getBags({ bagType: forge.pki.oids.keyBag });
      if (keyBagsRsa.keyBag && keyBagsRsa.keyBag.length > 0) {
        key = keyBagsRsa.keyBag[0].key;
      }
    }
    
    if (!key) {
      throw new Error('Chave privada não encontrada no arquivo .pfx');
    }

    const privateKeyPem = forge.pki.privateKeyToPem(key);

    return {
      certificate: certificatePem,
      privateKey: privateKeyPem,
    };
  } catch (error: any) {
    console.error('Erro ao processar .pfx:', error);
    throw new Error(`Erro ao processar .pfx: ${error.message}`);
  }
}

export const nfeRouter = router({
  /**
   * Configurações da empresa
   */
  getCompanyConfig: protectedProcedure.query(async ({ ctx }) => {
    return getCompanyConfig(ctx.user.id);
  }),

  updateCompanyConfig: protectedProcedure
    .input(CompanyConfigSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertCompanyConfig({
        userId: ctx.user.id,
        ...input,
      });
    }),

  /**
   * Certificados digitais
   */
  getCertificates: protectedProcedure.query(async ({ ctx }) => {
    return getCertificatesByUser(ctx.user.id);
  }),

  uploadCertificate: protectedProcedure
    .input(CertificateUploadSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        let certificatePem: string;
        let privateKeyPem: string;

        if (input.fileType === 'pfx') {
          // Processar arquivo .pfx
          if (!input.certificatePassword) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Senha do certificado .pfx é obrigatória.',
            });
          }

          try {
            const extracted = await extractCertificateFromPfx(
              input.certificateContent,
              input.certificatePassword
            );
            certificatePem = extracted.certificate;
            privateKeyPem = extracted.privateKey;
          } catch (pfxError: any) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Erro ao processar arquivo .pfx: ${pfxError.message}`,
            });
          }
        } else {
          // Processar arquivo PEM
          if (!input.certificateContent.includes('-----BEGIN CERTIFICATE-----')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Certificado inválido. Deve ser um arquivo PEM válido.',
            });
          }

          // Se privateKey foi enviado separadamente
          if (input.privateKey) {
            if (!input.privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
                !input.privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Chave privada inválida. Deve ser um arquivo PEM válido.',
              });
            }
            certificatePem = input.certificateContent;
            privateKeyPem = input.privateKey;
          } else {
            // Tentar extrair ambos do mesmo arquivo
            if (!input.certificateContent.includes('-----BEGIN PRIVATE KEY-----') && 
                !input.certificateContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Certificado inválido. Deve conter a chave privada ou envie a chave separadamente.',
              });
            }

            const certMatch = input.certificateContent.match(
              /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/
            );
            const keyMatch = input.certificateContent.match(
              /(-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----|-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----)/
            );

            if (!certMatch || !keyMatch) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Não foi possível extrair certificado e chave privada do arquivo.',
              });
            }

            certificatePem = certMatch[0];
            privateKeyPem = keyMatch[0];
          }
        }

        // Gerar thumbprint a partir do certificado público
        let thumbprint = '';
        try {
          thumbprint = generateThumbprint(certificatePem);
        } catch (e) {
          thumbprint = 'UNKNOWN';
        }
        
        // Extrair informações do certificado (CNPJ, etc)
        let extractedCnpj: string | undefined;
        try {
          const certInfo = extractCertificateInfo(certificatePem);
          extractedCnpj = certInfo.cnpj;
        } catch (e) {
          console.error('Erro ao extrair CNPJ:', e);
        }

        // Criar certificado com ambos (público e privado)
        let certificate;
        try {
          certificate = await createCertificate({
            userId: ctx.user.id,
            certificateName: input.certificateName,
            certificateContent: certificatePem,  // Certificado público
            certificateKeyContent: privateKeyPem,  // Chave privada
            thumbprint,
            isActive: 1,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
          });
        } catch (dbError: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao salvar certificado no banco de dados: ${dbError.message}`,
          });
        }

        try {
          await createAuditLog({
            userId: ctx.user.id,
            action: 'upload_certificate',
            details: `Certificado ${input.certificateName} enviado (${input.fileType})`,
            ipAddress: ctx.req.ip,
          });
        } catch (e) {
          console.error('Erro ao criar audit log:', e);
        }

        try {
          await notifyOwner({
            title: 'Certificado Digital Enviado',
            content: `Certificado ${input.certificateName} foi enviado com sucesso`,
          });
        } catch (e) {
          console.error('Erro ao notificar owner:', e);
        }

        return { 
          success: true, 
          certificate,
          extractedCnpj,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Erro ao fazer upload do certificado',
        });
      }
    }),

  /**
   * Emissão de DANFE-Se (NFS-e)
   */
  emitDanfse: protectedProcedure
    .input(EmitDanfseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Validar CPF/CNPJ
        if (!validateCpfOrCnpj(input.clientCpfCnpj)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'CPF/CNPJ do cliente inválido',
          });
        }

        // Obter certificado do usuário logado
        const certificate = await getActiveCertificate(ctx.user.id);
        if (!certificate) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Certificado não encontrado',
          });
        }

        // Validar que certificado tem ambos os campos
        if (!certificate.certificateContent || !certificate.certificateKeyContent) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Certificado incompleto. Faça upload de um novo certificado.',
          });
        }

        // Obter configurações da empresa
        const config = await getCompanyConfig(ctx.user.id);
        if (!config) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Configurações da empresa não encontradas. Configure os dados tributários primeiro.',
          });
        }

        // Criar registro de fatura
        const invoiceResult: any = await createInvoice({
          userId: ctx.user.id,
          certificateId: certificate.id,
          rpsNumber: Math.floor(Date.now() / 1000).toString(),
          rpsSeriesNumber: 'RPS',
          status: 'processing',
          clientName: input.clientName,
          clientCpfCnpj: input.clientCpfCnpj.replace(/\D/g, ''),
          clientAddress: input.clientAddress,
          clientCity: input.clientCity,
          clientState: input.clientState,
          clientZipCode: input.clientCep,
          serviceDescription: input.serviceDescription,
          serviceValue: input.serviceValue.toString(),
          deductions: (input.deductions || 0).toString(),
          discountValue: (input.discount || 0).toString(),
          issRate: input.issRate.toString(),
          issValue: ((input.serviceValue * input.issRate) / 100).toString(),
          observations: input.observations || null,
          serviceDate: new Date(),
        });

        const invoiceId = invoiceResult?.id || (Array.isArray(invoiceResult) ? invoiceResult[0]?.id : undefined);

        console.log('[NFe Router] Fatura criada:', invoiceId);

        // Emitir DANFE-Se via WebService da Prefeitura
        const soapClient = new PrefeituraSoapClient(true); // true = ambiente de produção
        
        const nfseResult = await soapClient.enviarRps(
          {
            numero: Math.floor(Date.now() / 1000),
            serie: 'RPS',
            tipo: 1, // 1 = RPS Normal
            dataEmissao: new Date().toISOString().split('T')[0],
            statusRps: 'N', // N = Normal
            prestadorCnpj: config.cnpj,
            prestadorInscricaoMunicipal: config.inscricaoMunicipal,
            tomadorCpfCnpj: input.clientCpfCnpj.replace(/\D/g, ''),
            tomadorRazaoSocial: input.clientName,
            tomadorLogradouro: input.clientAddress,
            tomadorNumero: '1',
            tomadorBairro: input.clientBairro,
            tomadorCidade: input.clientCity,
            tomadorEstado: input.clientState,
            tomadorCep: input.clientCep,
            servicoDescricao: input.serviceDescription,
            servicoValor: input.serviceValue,
            servicoItemLista: config.itemListaServico,
            deducoes: input.deductions || 0,
            desconto: input.discount || 0,
            issAliquota: input.issRate / 100,
            certificateContent: certificate.certificateContent,
            certificateKeyContent: certificate.certificateKeyContent,
            thumbprint: certificate.thumbprint,
          },
          certificate.certificateContent,
          certificate.certificateKeyContent
        );

        // Atualizar fatura com resultado
        if (nfseResult.success) {
          await updateInvoice(invoiceId, {
            status: 'authorized',
            nfseNumber: nfseResult.nfseNumber,
            protocolNumber: nfseResult.protocol,
            emittedAt: new Date(),
          });

          await notifyOwner({
            title: 'DANFE-Se Emitida com Sucesso',
            content: `NFS-e ${nfseResult.nfseNumber} emitida para ${input.clientName}`,
          });

          return {
            success: true,
            invoiceId,
            nfseNumber: nfseResult.nfseNumber,
            protocolNumber: nfseResult.protocol,
          };
        } else {
          await updateInvoice(invoiceId, {
            status: 'error',
            errorMessage: nfseResult.error,
          });

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao emitir DANFE-Se: ${nfseResult.error}`,
          });
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Erro ao emitir DANFE-Se',
        });
      }
    }),

  /**
   * Histórico de notas fiscais
   */
  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    return getInvoicesByUser(ctx.user.id);
  }),

  getInvoiceStats: protectedProcedure.query(async ({ ctx }) => {
    return getInvoiceStats(ctx.user.id);
  }),
});
