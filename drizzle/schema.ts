import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Configurações da empresa (dados tributários padrão)
 */
export const companyConfig = mysqlTable("company_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  inscricaoMunicipal: varchar("inscricaoMunicipal", { length: 20 }).notNull(),
  itemListaServico: varchar("itemListaServico", { length: 10 }).default("0101").notNull(),
  codigoCnae: varchar("codigoCnae", { length: 10 }).default("9602502").notNull(),
  regimeEspecialTributacao: varchar("regimeEspecialTributacao", { length: 1 }).default("1").notNull(),
  optanteSimplesNacional: varchar("optanteSimplesNacional", { length: 1 }).default("1").notNull(),
  incentivadorCultural: varchar("incentivadorCultural", { length: 1 }).default("2").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyConfig = typeof companyConfig.$inferSelect;
export type InsertCompanyConfig = typeof companyConfig.$inferInsert;

/**
 * Certificados digitais (chaves privadas PEM)
 */
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  certificateName: varchar("certificateName", { length: 255 }).notNull(),
  certificateKeyUrl: text("certificateKeyUrl").notNull(), // URL S3 da chave privada
  certificateKeyStorageKey: varchar("certificateKeyStorageKey", { length: 255 }).notNull(), // Chave de armazenamento S3
  thumbprint: varchar("thumbprint", { length: 255 }).notNull(), // Identificador único do certificado
  isActive: int("isActive").default(1).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

/**
 * Notas Fiscais Eletrônicas (RPS/NFS-e)
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  certificateId: int("certificateId").notNull().references(() => certificates.id),
  rpsNumber: varchar("rpsNumber", { length: 20 }).notNull(),
  rpsSeriesNumber: varchar("rpsSeriesNumber", { length: 5 }).default("RPS").notNull(),
  nfseNumber: varchar("nfseNumber", { length: 20 }),
  status: mysqlEnum("status", ["pending", "authorized", "error", "cancelled"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientCpfCnpj: varchar("clientCpfCnpj", { length: 18 }).notNull(),
  clientAddress: text("clientAddress").notNull(),
  serviceDescription: text("serviceDescription").notNull(),
  serviceValue: decimal("serviceValue", { precision: 12, scale: 2 }).notNull(),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0.00"),
  observations: text("observations"),
  xmlSignedUrl: text("xmlSignedUrl"),
  xmlSignedStorageKey: varchar("xmlSignedStorageKey", { length: 255 }),
  pdfUrl: text("pdfUrl"),
  pdfStorageKey: varchar("pdfStorageKey", { length: 255 }),
  emittedAt: timestamp("emittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Auditoria de emissões (log de todas as operações)
 */
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  invoiceId: int("invoiceId").references(() => invoices.id),
  action: varchar("action", { length: 50 }).notNull(), // 'emit', 'upload_cert', 'download', etc
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;