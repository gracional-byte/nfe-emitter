import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companyConfig, certificates, invoices, auditLog, InsertCompanyConfig, InsertCertificate, InsertInvoice, InsertAuditLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Configuração da empresa
 */
export async function getCompanyConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companyConfig).where(eq(companyConfig.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertCompanyConfig(config: InsertCompanyConfig) {
  const db = await getDb();
  if (!db) return;
  await db.insert(companyConfig).values(config).onDuplicateKeyUpdate({
    set: {
      cnpj: config.cnpj,
      inscricaoMunicipal: config.inscricaoMunicipal,
      itemListaServico: config.itemListaServico,
      codigoCnae: config.codigoCnae,
      regimeEspecialTributacao: config.regimeEspecialTributacao,
      optanteSimplesNacional: config.optanteSimplesNacional,
      incentivadorCultural: config.incentivadorCultural,
    },
  });
}

/**
 * Certificados digitais
 */
export async function getCertificatesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(certificates).where(eq(certificates.userId, userId));
}

export async function getActiveCertificate(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates).where(
    and(eq(certificates.userId, userId), eq(certificates.isActive, 1))
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCertificate(cert: InsertCertificate) {
  const db = await getDb();
  if (!db) return;
  await db.insert(certificates).values(cert);
}

/**
 * Notas Fiscais
 */
export async function getInvoicesByUser(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices)
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getInvoiceById(invoiceId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createInvoice(invoice: InsertInvoice) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(invoices).values(invoice);
  return result;
}

export async function updateInvoice(invoiceId: number, updates: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set(updates).where(eq(invoices.id, invoiceId));
}

export async function getInvoiceStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, thisMonth: 0, totalValue: 0 };
  
  const allInvoices = await db.select().from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.status, 'authorized')));
  
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const thisMonth = allInvoices.filter(inv => new Date(inv.createdAt) >= currentMonth);
  const totalValue = allInvoices.reduce((sum, inv) => sum + Number(inv.serviceValue), 0);
  
  return {
    total: allInvoices.length,
    thisMonth: thisMonth.length,
    totalValue,
  };
}

/**
 * Auditoria
 */
export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLog).values(log);
}
