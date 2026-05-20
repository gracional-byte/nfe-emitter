import { describe, it, expect } from 'vitest';
import { isValidCPF, isValidCNPJ, isValidCPFOrCNPJ } from './validation';

describe('CPF Validation', () => {
  it('should validate a valid CPF', () => {
    // CPF válido: 11144477735
    expect(isValidCPF('11144477735')).toBe(true);
    expect(isValidCPF('111.444.777-35')).toBe(true);
  });

  it('should reject an invalid CPF', () => {
    expect(isValidCPF('11111111111')).toBe(false);
    expect(isValidCPF('12345678901')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });

  it('should handle CPF with formatting', () => {
    expect(isValidCPF('111.444.777-35')).toBe(true);
  });
});

describe('CNPJ Validation', () => {
  it('should validate a valid CNPJ', () => {
    // CNPJ válido: 11222333000181
    expect(isValidCNPJ('11222333000181')).toBe(true);
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('should reject an invalid CNPJ', () => {
    expect(isValidCNPJ('11111111111111')).toBe(false);
    expect(isValidCNPJ('12345678901234')).toBe(false);
    expect(isValidCNPJ('123')).toBe(false);
  });

  it('should handle CNPJ with formatting', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
  });
});

describe('CPF or CNPJ Validation', () => {
  it('should validate both CPF and CNPJ', () => {
    expect(isValidCPFOrCNPJ('11144477735')).toBe(true);
    expect(isValidCPFOrCNPJ('11222333000181')).toBe(true);
  });

  it('should reject invalid documents', () => {
    expect(isValidCPFOrCNPJ('11111111111')).toBe(false);
    expect(isValidCPFOrCNPJ('11111111111111')).toBe(false);
    expect(isValidCPFOrCNPJ('123')).toBe(false);
  });
});
