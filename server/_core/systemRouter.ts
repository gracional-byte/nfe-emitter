import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  readFile: adminProcedure
    .input(
      z.object({
        filePath: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const allowedPaths = [
          'server/routers/nfe.ts',
          'server/nfe-service.ts',
          'client/src/pages/EmitRps.tsx',
          'client/src/pages/Dashboard.tsx',
        ];

        if (!allowedPaths.includes(input.filePath)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Arquivo não permitido',
          });
        }

        const fullPath = path.join(process.cwd(), input.filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        return { content };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao ler arquivo',
        });
      }
    }),

  editFile: adminProcedure
    .input(
      z.object({
        filePath: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const allowedPaths = [
          'server/routers/nfe.ts',
          'server/nfe-service.ts',
          'client/src/pages/EmitRps.tsx',
          'client/src/pages/Dashboard.tsx',
        ];

        if (!allowedPaths.includes(input.filePath)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Arquivo não permitido',
          });
        }

        const fullPath = path.join(process.cwd(), input.filePath);
        fs.writeFileSync(fullPath, input.content, 'utf-8');

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao salvar arquivo',
        });
      }
    }),
});
