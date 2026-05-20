/**
 * Valida CPF usando o algoritmo oficial
 */
export function isValidCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCpf = cpf.replace(/\D/g, '');

  // Verifica se tem 11 dígitos
  if (cleanCpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 > 9 ? 0 : digit1;

  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 > 9 ? 0 : digit2;

  // Verifica se os dígitos calculados batem com os informados
  return (
    digit1 === parseInt(cleanCpf[9]) &&
    digit2 === parseInt(cleanCpf[10])
  );
}

/**
 * Valida CNPJ usando o algoritmo oficial
 */
export function isValidCNPJ(cnpj: string): boolean {
  // Remove caracteres não numéricos
  const cleanCnpj = cnpj.replace(/\D/g, '');

  // Verifica se tem 14 dígitos
  if (cleanCnpj.length !== 14) return false;

  // Verifica se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;

  // Calcula o primeiro dígito verificador
  let sum = 0;
  const multiplier1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj[i]) * multiplier1[i];
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 > 9 ? 0 : digit1;

  // Calcula o segundo dígito verificador
  sum = 0;
  const multiplier2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj[i]) * multiplier2[i];
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 > 9 ? 0 : digit2;

  // Verifica se os dígitos calculados batem com os informados
  return (
    digit1 === parseInt(cleanCnpj[12]) &&
    digit2 === parseInt(cleanCnpj[13])
  );
}

/**
 * Valida CPF ou CNPJ
 */
export function isValidCPFOrCNPJ(value: string): boolean {
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length === 11) {
    return isValidCPF(value);
  } else if (cleanValue.length === 14) {
    return isValidCNPJ(value);
  }
  
  return false;
}
