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
} from '../db';
import { signXml, generateRpsXml, validateCpfOrCnpj, validatePrivateKey, generateThumbprint, generateDanfsePdf } from '../nfe-service';
import { storagePut, storageGet } from '../storage';
import { notifyOwner } from '../_core/notification';
import fs from 'fs';
import path from 'path';

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

const EmitRpsSchema = z.object({
  clientName: z.string(),
  clientCpfCnpj: z.string(),
  clientAddress: z.string(),
  clientCity: z.string(),
  clientState: z.string(),
  clientCep: z.string(),
  serviceDescription: z.string(),
  serviceValue: z.number(),
  deductions: z.number().optional(),
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
        // Validar CNPJ
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
   * Emissão de RPS
   */
  emitRps: protectedProcedure
    .input(EmitRpsSchema)
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

        // Gerar número do RPS
        const rpsNumber = Math.floor(Date.now() / 1000).toString();

        // Gerar XML do RPS
        const xmlContent = generateRpsXml({
          numeroLote: Date.now().toString(),
          cnpj: config.cnpj,
          inscricaoMunicipal: config.inscricaoMunicipal,
          rpsNumber,
          rpsSeries: 'RPS',
          rpsType: '1',
          clientName: input.clientName,
          clientCpfCnpj: input.clientCpfCnpj.replace(/\D/g, ''),
          clientAddress: input.clientAddress,
          clientCity: input.clientCity,
          clientState: input.clientState,
          clientCep: input.clientCep,
          serviceDescription: input.serviceDescription,
          serviceValue: String(input.serviceValue),
          deductions: String(input.deductions || '0'),
          itemListaServico: config.itemListaServico,
          codigoCnae: config.codigoCnae,
          regimeEspecialTributacao: config.regimeEspecialTributacao || '',
          optanteSimplesNacional: config.optanteSimplesNacional,
          incentivadorCultural: config.incentivadorCultural,
        });

        // Obter chave privada
        let privateKeyContent = certificate.certificateKeyContent;

        // Se não tiver no banco, tenta ler do arquivo local
        if (!privateKeyContent) {
          const localKeyPath = path.join(process.cwd(), 'private-key.pem');
          if (fs.existsSync(localKeyPath)) {
            privateKeyContent = fs.readFileSync(localKeyPath, 'utf-8');
          }
        }

        if (!privateKeyContent) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Chave privada não encontrada',
          });
        }

        // Assinar XML
        const signedXml = await signXml(xmlContent, privateKeyContent, certificate.thumbprint);

        // Gerar PDF/DANFSe
        const danfsePdfHtml = generateDanfsePdf({
          numeroLote: Date.now().toString(),
          cnpj: config.cnpj,
          inscricaoMunicipal: config.inscricaoMunicipal,
          rpsNumber,
          rpsSeries: 'RPS',
          rpsType: '1',
          clientName: input.clientName,
          clientCpfCnpj: input.clientCpfCnpj.replace(/\D/g, ''),
          clientAddress: input.clientAddress,
          clientCity: input.clientCity,
          clientState: input.clientState,
          clientCep: input.clientCep,
          serviceDescription: input.serviceDescription,
          serviceValue: String(input.serviceValue),
          deductions: String(input.deductions || '0'),
          itemListaServico: config.itemListaServico,
          codigoCnae: config.codigoCnae,
          regimeEspecialTributacao: config.regimeEspecialTributacao || '',
          optanteSimplesNacional: config.optanteSimplesNacional,
          incentivadorCultural: config.incentivadorCultural,
          emittedAt: new Date(),
        });

        // Armazenar XML assinado diretamente no banco de dados
        const invoiceResult = await createInvoice({
          userId: ctx.user.id,
          certificateId: certificate.id,
          rpsNumber,
          rpsSeriesNumber: 'RPS',
          status: 'authorized',
          clientName: input.clientName,
          clientCpfCnpj: input.clientCpfCnpj,
          clientAddress: input.clientAddress,
          serviceDescription: input.serviceDescription,
          serviceValue: String(input.serviceValue),
          deductions: String(input.deductions || '0'),
          observations: input.observations,
          xmlSignedUrl: signedXml.substring(0, 100), // Armazenar preview do XML
          xmlSignedStorageKey: signedXml, // Armazenar XML completo
          pdfUrl: danfsePdfHtml.substring(0, 100), // Armazenar preview do PDF
          pdfStorageKey: danfsePdfHtml, // Armazenar PDF completo
          emittedAt: new Date(),
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: 'emit_rps',
          details: `RPS ${rpsNumber} emitido para ${input.clientName}`,
          ipAddress: ctx.req.ip,
        });

        // Notificar proprietário
        await notifyOwner({
          title: 'Nova Nota Fiscal Emitida',
          content: `Uma nova nota fiscal foi emitida com sucesso para ${input.clientName} no valor de R$ ${input.serviceValue}`,
        });

        return {
          success: true,
          rpsNumber,
          message: 'RPS emitido com sucesso',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao emitir RPS';

        // Notificar proprietário sobre erro
        await notifyOwner({
          title: 'Erro na Emissão de Nota Fiscal',
          content: `Erro ao emitir RPS para ${input.clientName}: ${message}`,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Histórico de notas fiscais
   */
  getInvoices: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(10),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return getInvoicesByUser(ctx.user.id, input.limit, input.offset);
    }),

  getInvoiceStats: protectedProcedure.query(async ({ ctx }) => {
    return getInvoiceStats(ctx.user.id);
  }),
});
