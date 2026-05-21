import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
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
  certificateContent: z.string(),
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
});

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
      try {
        if (input.cnpj.length !== 14 || !/^\d+$/.test(input.cnpj)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'CNPJ inválido',
          });
        }

        await upsertCompanyConfig({ userId: ctx.user.id, ...input });

        await createAuditLog({
          userId: ctx.user.id,
          action: 'update_config',
          details: `Configurações da empresa atualizadas`,
          ipAddress: ctx.req.ip,
        });

        return { success: true };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Erro ao atualizar configurações',
        });
      }
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
        // Validar certificado PEM
        if (!input.certificateContent.includes('-----BEGIN CERTIFICATE-----')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Certificado inválido. Deve ser um arquivo PEM válido.',
          });
        }

        // Gerar thumbprint
        const thumbprint = generateThumbprint(input.certificateContent);

        // Criar certificado
        const certificate = await createCertificate({
          userId: ctx.user.id,
          certificateName: input.certificateName,
          certificateKeyContent: input.certificateContent,
          thumbprint,
          isActive: 1,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: 'upload_certificate',
          details: `Certificado ${input.certificateName} enviado`,
          ipAddress: ctx.req.ip,
        });

        await notifyOwner({
          title: 'Certificado Digital Enviado',
          content: `Certificado ${input.certificateName} foi enviado com sucesso`,
        });

        return { success: true, certificate };
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
        // Validar CPF/CNPJ do cliente
        if (!validateCpfOrCnpj(input.clientCpfCnpj)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'CPF ou CNPJ do cliente inválido',
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

        // Obter certificado ativo
        const certificate = await getActiveCertificate(ctx.user.id);
        if (!certificate) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Nenhum certificado digital ativo encontrado',
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
        const soapClient = new PrefeituraSoapClient(false); // false = ambiente de teste
        
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
            issRetido: 'N', // N = ISS não retido
            issAliquota: input.issRate / 100, // Converter para decimal
            dataFato: new Date().toISOString().split('T')[0],
            observacoes: input.observations,
          },
          certificate.certificateKeyContent || '',
          certificate.certificateKeyContent || ''
        );

        if (!nfseResult.success) {
          // Atualizar fatura com erro
          if (invoiceId) {
            await updateInvoice(invoiceId as number, {
              status: 'error',
              errorMessage: nfseResult.error || undefined,
            });
          }

          await notifyOwner({
            title: 'Erro na Emissão de DANFE-Se',
            content: `Erro ao emitir DANFE-Se para ${input.clientName}: ${nfseResult.error}`,
          });

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Falha ao emitir DANFE-Se: ${nfseResult.error}`,
          });
        }

        // Atualizar fatura com sucesso
        if (invoiceId) {
          await updateInvoice(invoiceId as number, {
            status: 'authorized',
            nfseNumber: nfseResult.nfseNumber || undefined,
            protocolNumber: nfseResult.protocol || undefined,
            emittedAt: new Date(),
          });
        }

        await createAuditLog({
          userId: ctx.user.id,
          action: 'emit_danfse',
          details: `DANFE-Se emitida: ${nfseResult.nfseNumber}`,
          ipAddress: ctx.req.ip,
        });

        await notifyOwner({
          title: 'DANFE-Se Emitida com Sucesso',
          content: `DANFE-Se #${nfseResult.nfseNumber} emitida para ${input.clientName}`,
        });

        return {
          success: true,
          invoiceId: invoiceId || 0,
          nfseNumber: nfseResult.nfseNumber,
          protocolNumber: nfseResult.protocol,
        };
      } catch (error: any) {
        console.error('[NFe Router] Erro ao emitir DANFE-Se:', error);
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

  getStats: protectedProcedure.query(async ({ ctx }) => {
    return getInvoiceStats(ctx.user.id);
  }),
});
