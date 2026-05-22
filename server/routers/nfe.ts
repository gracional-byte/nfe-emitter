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
import { GovValidationClient } from '../gov-validation-client';
import { generateDanfsePdf, DanfsePdfData } from '../danfse-generator';
import { ConsultaNfseClient } from '../consulta-nfse-client';
import { CancelamentoNfseClient } from '../cancelamento-nfse-client';

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

        // Validar certificado e RPS via Gov.br
        const govClient = new GovValidationClient();
        const govValidation = await govClient.validateRps({
          certificatePem: certificate.certificateContent,
          privateKeyPem: certificate.certificateKeyContent,
          rpsData: {
            numero: Math.floor(Date.now() / 1000),
            serie: 'RPS',
            prestadorCnpj: config.cnpj,
            tomadorCpfCnpj: input.clientCpfCnpj.replace(/\D/g, ''),
            servicoValor: input.serviceValue,
            dataEmissao: new Date().toISOString().split('T')[0],
          },
        });

        if (!govValidation.valid) {
          console.error('[NFe Router] Validação Gov.br falhou:', govValidation.error);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Validação falhou: ${govValidation.error}`,
          });
        }

        console.log('[NFe Router] Validação Gov.br passou:', govValidation.message);

        // Emitir DANFE-Se via WebService da Prefeitura
        const soapClient = new PrefeituraSoapClient(); // Conectar ao webservice da Prefeitura SP
        
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
          },
          certificate.certificateContent,
          certificate.certificateKeyContent
        );

        // Atualizar fatura com resultado
        if (nfseResult.success) {
          // Gerar PDF DANFE-Se
          console.log('[NFe Router] Gerando PDF DANFE-Se...');
          const danfsePdfData: DanfsePdfData = {
            nfseNumber: nfseResult.nfseNumber || 'PENDENTE',
            seriesNumber: '1',
            emissionDate: new Date().toLocaleDateString('pt-BR'),
            verificationCode: nfseResult.protocol || 'PENDENTE',
            
            prestadorName: config.cnpj, // Será preenchido com dados reais da empresa
            prestadorCnpj: config.cnpj,
            prestadorInscricaoMunicipal: config.inscricaoMunicipal,
            prestadorAddress: 'Endereço da Empresa',
            prestadorCity: 'São Paulo',
            prestadorState: 'SP',
            prestadorCep: '01000000',
            
            tomadorName: input.clientName,
            tomadorCpfCnpj: input.clientCpfCnpj,
            tomadorAddress: input.clientAddress,
            tomadorCity: input.clientCity,
            tomadorState: input.clientState,
            tomadorCep: input.clientCep,
            tomadorBairro: input.clientBairro,
            
            serviceDescription: input.serviceDescription,
            serviceValue: input.serviceValue,
            issRate: input.issRate,
            issValue: (input.serviceValue * input.issRate) / 100,
            deductions: input.deductions || 0,
            discount: input.discount || 0,
            netValue: input.serviceValue - (input.deductions || 0) - (input.discount || 0),
            
            observations: input.observations,
          };
          
          try {
            const pdfBuffer = await generateDanfsePdf(danfsePdfData);
            
            // Armazenar PDF no S3
            console.log('[NFe Router] Armazenando PDF no S3...');
            const pdfStorageKey = `nfse/${ctx.user.id}/${nfseResult.nfseNumber}.pdf`;
            const { url: pdfUrl } = await storagePut(pdfStorageKey, pdfBuffer, 'application/pdf');
            
            console.log('[NFe Router] PDF armazenado com sucesso:', pdfUrl);
            
            // Atualizar fatura com dados da emissão
            await updateInvoice(invoiceId, {
              status: 'authorized',
              nfseNumber: nfseResult.nfseNumber,
              protocolNumber: nfseResult.protocol || '',
              emittedAt: new Date(),
              pdfUrl: pdfUrl,
              pdfStorageKey: pdfStorageKey,
            });
          } catch (pdfError: any) {
            console.error('[NFe Router] Erro ao gerar PDF:', pdfError?.message);
            // Continuar mesmo se falhar ao gerar PDF
            await updateInvoice(invoiceId, {
              status: 'authorized',
              nfseNumber: nfseResult.nfseNumber,
              protocolNumber: nfseResult.protocol || '',
              emittedAt: new Date(),
            });
          }

          await notifyOwner({
            title: 'DANFE-Se Emitida com Sucesso',
            content: `NFS-e ${nfseResult.nfseNumber} emitida para ${input.clientName}`,
          });

          return {
            success: true,
            invoiceId,
            nfseNumber: nfseResult.nfseNumber,
            protocol: nfseResult.protocol || '',
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

  /**
   * Download do PDF DANFE-Se
   */
  downloadPdf: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const invoices = await getInvoicesByUser(ctx.user.id);
        const invoiceData = Array.isArray(invoices) 
          ? invoices.find(inv => inv.id === input.invoiceId)
          : invoices;

        if (!invoiceData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Nota fiscal não encontrada',
          });
        }

        if (!invoiceData.pdfUrl) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'PDF não disponível para esta nota fiscal',
          });
        }

        return {
          pdfUrl: invoiceData.pdfUrl,
          fileName: `DANFE-Se-${invoiceData.nfseNumber}.pdf`,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Erro ao obter PDF',
        });
      }
    }),

  /**
   * Consultar NFS-e na Prefeitura
   */
  consultarNfse: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const invoices = await getInvoicesByUser(ctx.user.id);
        const invoiceData = Array.isArray(invoices) 
          ? invoices.find(inv => inv.id === input.invoiceId)
          : invoices;

        if (!invoiceData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Nota fiscal não encontrada',
          });
        }

        if (!invoiceData.nfseNumber) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Nota fiscal ainda não foi emitida',
          });
        }

        console.log('[NFe Router] Consultando NFS-e:', invoiceData.nfseNumber);

        // Obter certificado do usuário
        const certificate = await getActiveCertificate(ctx.user.id);
        if (!certificate) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Certificado não encontrado',
          });
        }

        // Obter configurações da empresa
        const config = await getCompanyConfig(ctx.user.id);
        if (!config) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Configurações da empresa não encontradas',
          });
        }

        // Consultar na Prefeitura
        const consultaClient = new ConsultaNfseClient();
        const consultaResult = await consultaClient.consultarNfse({
          nfseNumber: invoiceData.nfseNumber,
          prestadorCnpj: config.cnpj,
          tomadorCpfCnpj: invoiceData.clientCpfCnpj,
          certificateContent: certificate.certificateContent || '',
          certificateKeyContent: certificate.certificateKeyContent || '',
        });

        if (consultaResult.success) {
          console.log('[NFe Router] Consulta bem-sucedida:', consultaResult);
          return {
            success: true,
            nfseNumber: consultaResult.nfseNumber,
            status: consultaResult.status,
            emissionDate: consultaResult.emissionDate,
            verificationCode: consultaResult.verificationCode,
          };
        } else {
          console.error('[NFe Router] Erro na consulta:', consultaResult.error);
          // Retornar dados armazenados como fallback
          return {
            success: false,
            nfseNumber: invoiceData.nfseNumber,
            status: invoiceData.status,
            emittedAt: invoiceData.emittedAt,
            protocolNumber: invoiceData.protocolNumber,
            error: consultaResult.error,
          };
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Erro ao consultar NFS-e',
        });
      }
    }),

  /**
   * Cancelar NFS-e
   */
  cancelarNfse: protectedProcedure
    .input(z.object({ 
      invoiceId: z.number(),
      justificativa: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const invoices = await getInvoicesByUser(ctx.user.id);
        const invoiceData = Array.isArray(invoices) 
          ? invoices.find(inv => inv.id === input.invoiceId)
          : invoices;

        if (!invoiceData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Nota fiscal não encontrada',
          });
        }

        if (!invoiceData.nfseNumber) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Nota fiscal ainda não foi emitida',
          });
        }

        if (invoiceData.status === 'cancelled') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Esta nota fiscal já foi cancelada',
          });
        }

        console.log('[NFe Router] Cancelando NFS-e:', invoiceData.nfseNumber);

        // Obter certificado do usuário
        const certificate = await getActiveCertificate(ctx.user.id);
        if (!certificate) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Certificado não encontrado',
          });
        }

        // Obter configurações da empresa
        const config = await getCompanyConfig(ctx.user.id);
        if (!config) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Configurações da empresa não encontradas',
          });
        }

        // Cancelar na Prefeitura
        const cancelamentoClient = new CancelamentoNfseClient();
        const cancelamentoResult = await cancelamentoClient.cancelarNfse({
          nfseNumber: invoiceData.nfseNumber,
          prestadorCnpj: config.cnpj,
          inscricaoMunicipal: config.inscricaoMunicipal,
          justificativa: input.justificativa || 'Cancelamento solicitado pelo usuário',
          certificateContent: certificate.certificateContent || '',
          certificateKeyContent: certificate.certificateKeyContent || '',
        });

        if (cancelamentoResult.success) {
          console.log('[NFe Router] Cancelamento bem-sucedido:', cancelamentoResult);
          
          // Atualizar status no banco de dados
          await updateInvoice(invoiceData.id, {
            status: 'cancelled',
            errorMessage: `Cancelada em ${cancelamentoResult.cancelmentDate}: ${input.justificativa || 'Sem justificativa'}`,
          });

          await notifyOwner({
            title: 'DANFE-Se Cancelada com Sucesso',
            content: `NFS-e ${invoiceData.nfseNumber} foi cancelada na Prefeitura`,
          });

          return {
            success: true,
            message: 'Nota fiscal cancelada com sucesso',
            nfseNumber: invoiceData.nfseNumber,
            protocolNumber: cancelamentoResult.protocolNumber,
          };
        } else {
          console.error('[NFe Router] Erro no cancelamento:', cancelamentoResult.error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao cancelar na Prefeitura: ${cancelamentoResult.error}`,
          });
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Erro ao cancelar NFS-e',
        });
      }
    }),
});
