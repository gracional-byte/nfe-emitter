import { describe, it, expect } from 'vitest';
import { validateCpf, validateCnpj } from './nfe-service';

describe('NFe Service - Document Validation', () => {
  describe('CPF Validation', () => {
    it('should validate a valid CPF', () => {
      expect(validateCpf('11144477735')).toBe(true);
    });

    it('should reject an invalid CPF', () => {
      expect(validateCpf('11111111111')).toBe(false);
      expect(validateCpf('12345678901')).toBe(false);
      expect(validateCpf('123')).toBe(false);
    });

    it('should handle CPF with formatting', () => {
      expect(validateCpf('111.444.777-35')).toBe(true);
    });
  });

  describe('CNPJ Validation', () => {
    it('should validate a valid CNPJ', () => {
      expect(validateCnpj('11222333000181')).toBe(true);
    });

    it('should reject an invalid CNPJ', () => {
      expect(validateCnpj('11111111111111')).toBe(false);
      expect(validateCnpj('12345678901234')).toBe(false);
      expect(validateCnpj('123')).toBe(false);
    });

    it('should handle CNPJ with formatting', () => {
      expect(validateCnpj('11.222.333/0001-81')).toBe(true);
    });
  });
});
