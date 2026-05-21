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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao atualizar configurações';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Listar certificados do usuário
   */
  getCertificates: protectedProcedure.query(async ({ ctx }) => {
    return getCertificatesByUser(ctx.user.id);
  }),

  /**
   * Upload de certificado digital
   */
  uploadCertificate: protectedProcedure
    .input(CertificateUploadSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (!input.certificateContent.includes('-----BEGIN') || !input.certificateContent.includes('-----END')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Arquivo inválido. Por favor, envie um certificado em formato PEM',
          });
        }

        const thumbprint = generateThumbprint(input.certificateName);

        await createCertificate({
          userId: ctx.user.id,
          certificateName: input.certificateName,
          certificateKeyContent: input.certificateContent,
          thumbprint,
          isActive: 1,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: 'upload_certificate',
          details: `Certificado ${input.certificateName} enviado`,
          ipAddress: ctx.req.ip,
        });

        await notifyOwner({
          title: 'Novo Certificado Digital',
          content: `Um novo certificado digital foi enviado: ${input.certificateName}`,
        });

        return { success: true, message: 'Certificado enviado com sucesso' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao enviar certificado';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
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
        const invoice = await createInvoice({
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

        console.log('[NFe Router] Fatura criada:', invoice);

        // Emitir DANFE-Se
        const nfseResult = await emitNfse({
          prestadorCnpj: config.cnpj,
          prestadorInscricaoMunicipal: config.inscricaoMunicipal,
          prestadorRazaoSocial: 'Empresa Prestadora',
          prestadorLogradouro: 'Rua Exemplo',
          prestadorNumero: '123',
          prestadorBairro: 'Bairro',
          prestadorCidade: 'São Paulo',
          prestadorEstado: 'SP',
          prestadorCep: '01310100',
          tomadorCpfCnpj: input.clientCpfCnpj,
          tomadorRazaoSocial: input.clientName,
          tomadorLogradouro: input.clientAddress,
          tomadorNumero: '1',
          tomadorBairro: input.clientBairro,
          tomadorCidade: input.clientCity,
          tomadorEstado: input.clientState,
          tomadorCep: input.clientCep,
          servicoDescricao: input.serviceDescription,
          servicoValor: input.serviceValue,
          servicoAliquotaIss: input.issRate,
          servicoItemLista: config.itemListaServico,
          deducoes: input.deductions,
          desconto: input.discount,
          observacoes: input.observations,
          certificateContent: certificate.certificateKeyContent || '',
        });

        if (!nfseResult.success) {
          // Atualizar fatura com erro
          if (invoice) {
            await updateInvoice(invoice[0].insertId as number, {
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
        if (invoice) {
          await updateInvoice(invoice[0].insertId as number, {
            status: 'authorized',
            nfseNumber: nfseResult.nfseNumber || undefined,
            protocolNumber: nfseResult.protocolNumber || undefined,
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
          invoiceId: invoice ? (invoice[0].insertId as number) : 0,
          nfseNumber: nfseResult.nfseNumber,
          protocolNumber: nfseResult.protocolNumber,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao emitir DANFE-Se';
        console.error('[NFe Router] Erro:', message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Listar histórico de emissões
   */
  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    return getInvoicesByUser(ctx.user.id);
  }),

  /**
   * Obter estatísticas de emissões
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return getInvoiceStats(ctx.user.id);
  }),
});
