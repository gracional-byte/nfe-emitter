import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  getCompanyConfig,
  upsertCompanyConfig,
  getCertificatesByUser,
  getActiveCertificate,
  createCertificate,
  getInvoicesByUser,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  getInvoiceStats,
  createAuditLog,
} from '../db';
import { storagePut, storageGet } from '../storage';
import {
  generateRpsXml,
  signXml,
  validatePrivateKey,
  generateThumbprint,
  validateCpfOrCnpj,
  formatCnpj,
} from '../nfe-service';
import { notifyOwner } from '../_core/notification';

/**
 * Validação de schemas
 */
const CompanyConfigSchema = z.object({
  cnpj: z.string().min(14).max(18),
  inscricaoMunicipal: z.string().min(1).max(20),
  itemListaServico: z.string().default('0101'),
  codigoCnae: z.string().default('9602502'),
  regimeEspecialTributacao: z.string().default('1'),
  optanteSimplesNacional: z.string().default('1'),
  incentivadorCultural: z.string().default('2'),
});

const CertificateUploadSchema = z.object({
  certificateName: z.string().min(1).max(255),
  certificateContent: z.string().min(100), // PEM content
});

const EmitRpsSchema = z.object({
  clientName: z.string().min(1).max(255),
  clientCpfCnpj: z.string().min(11).max(18),
  clientAddress: z.string().min(1),
  clientCity: z.string().default('São Paulo'),
  clientState: z.string().default('SP'),
  clientCep: z.string().default('01001000'),
  serviceDescription: z.string().min(1),
  serviceValue: z.string().or(z.number()),
  deductions: z.string().or(z.number()).default('0'),
  observations: z.string().optional(),
});

/**
 * Router de NFe
 */
export const nfeRouter = router({
  /**
   * Configurações da empresa
   */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await getCompanyConfig(ctx.user.id);
    return config || null;
  }),

  updateConfig: protectedProcedure
    .input(CompanyConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await upsertCompanyConfig({
          userId: ctx.user.id,
          ...input,
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: 'update_config',
          details: `Configurações da empresa atualizadas: CNPJ ${input.cnpj}`,
          ipAddress: ctx.req.ip,
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao atualizar configurações',
        });
      }
    }),

  /**
   * Certificados digitais
   */
  listCertificates: protectedProcedure.query(async ({ ctx }) => {
    return getCertificatesByUser(ctx.user.id);
  }),

  uploadCertificate: protectedProcedure
    .input(CertificateUploadSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Validar chave privada
        if (!validatePrivateKey(input.certificateContent)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Chave privada em formato PEM inválido',
          });
        }

        // Gerar thumbprint
        const thumbprint = generateThumbprint(input.certificateName);

        // Fazer upload para S3
        const storageKey = `certificates/${ctx.user.id}/${thumbprint}.pem`;
        const { url } = await storagePut(storageKey, input.certificateContent, 'text/plain');

        // Salvar no banco de dados
        await createCertificate({
          userId: ctx.user.id,
          certificateName: input.certificateName,
          certificateKeyUrl: url,
          certificateKeyStorageKey: storageKey,
          certificateKeyContent: input.certificateContent,
          thumbprint,
          isActive: 1,
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: 'upload_certificate',
          details: `Certificado ${input.certificateName} enviado`,
          ipAddress: ctx.req.ip,
        });

        return { success: true, thumbprint };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao fazer upload do certificado';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
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
          regimeEspecialTributacao: config.regimeEspecialTributacao,
          optanteSimplesNacional: config.optanteSimplesNacional,
          incentivadorCultural: config.incentivadorCultural,
        });

        // Obter chave privada do banco de dados
        let privateKeyContent = '';
        try {
          if (!certificate.certificateKeyContent) {
            throw new Error('Certificado digital nao encontrado no banco de dados');
          }
          privateKeyContent = certificate.certificateKeyContent;
          if (!privateKeyContent.includes('-----BEGIN')) {
            throw new Error('Conteudo de certificado invalido');
          }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao recuperar certificado digital: ${error instanceof Error ? error.message : 'Desconhecido'}`,
          });
        }

        // Assinar XML
        const signedXml = await signXml(xmlContent, privateKeyContent, certificate.thumbprint);

        // Fazer upload do XML assinado para S3
        const xmlStorageKey = `invoices/${ctx.user.id}/${rpsNumber}_signed.xml`;
        const { url: xmlUrl } = await storagePut(xmlStorageKey, signedXml, 'application/xml');

        // Salvar nota fiscal no banco de dados
        const invoiceResult = await createInvoice({
          userId: ctx.user.id,
          certificateId: certificate.id,
          rpsNumber,
          rpsSeriesNumber: 'RPS',
          status: 'authorized', // Simplificado: em produção seria 'pending' até confirmação da prefeitura
          clientName: input.clientName,
          clientCpfCnpj: input.clientCpfCnpj,
          clientAddress: input.clientAddress,
          serviceDescription: input.serviceDescription,
          serviceValue: String(input.serviceValue),
          deductions: String(input.deductions || '0'),
          observations: input.observations,
          xmlSignedUrl: xmlUrl,
          xmlSignedStorageKey: xmlStorageKey,
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
          xmlUrl,
          message: 'RPS emitido com sucesso',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao emitir RPS';

        // Notificar proprietário sobre erro
        await notifyOwner({
          title: 'Erro na Emissão de Nota Fiscal',
          content: `Erro ao emitir RPS: ${message}`,
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
  listInvoices: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;
      const invoices = await getInvoicesByUser(ctx.user.id, input.limit, offset);
      return invoices;
    }),

  getInvoice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await getInvoiceById(input.id, ctx.user.id);
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nota fiscal não encontrada',
        });
      }
      return invoice;
    }),

  /**
   * Dashboard
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return getInvoiceStats(ctx.user.id);
  }),
});
