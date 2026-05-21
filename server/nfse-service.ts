/**
 * Serviço de emissão de DANFE-Se (NFS-e) usando node-nfe
 * Integração com Prefeitura de São Paulo
 */

import { NFe } from 'node-nfe';
import fs from 'fs';
import path from 'path';

export interface NfseEmissionData {
  // Dados do prestador
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  prestadorRazaoSocial: string;
  prestadorLogradouro: string;
  prestadorNumero: string;
  prestadorComplemento?: string;
  prestadorBairro: string;
  prestadorCidade: string;
  prestadorEstado: string;
  prestadorCep: string;

  // Dados do tomador
  tomadorCpfCnpj: string;
  tomadorRazaoSocial: string;
  tomadorLogradouro: string;
  tomadorNumero: string;
  tomadorComplemento?: string;
  tomadorBairro: string;
  tomadorCidade: string;
  tomadorEstado: string;
  tomadorCep: string;

  // Dados do serviço
  servicoDescricao: string;
  servicoValor: number;
  servicoAliquotaIss: number;
  servicoItemLista: string;
  deducoes?: number;
  desconto?: number;
  observacoes?: string;

  // Certificado
  certificatePath?: string;
  certificatePassword?: string;
  certificateContent?: string;
}

export interface NfseEmissionResult {
  success: boolean;
  nfseNumber?: string;
  protocolNumber?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  error?: string;
}

/**
 * Emite uma DANFE-Se (NFS-e) na Prefeitura de SP
 */
export async function emitNfse(data: NfseEmissionData): Promise<NfseEmissionResult> {
  try {
    console.log('[NFSe Service] Iniciando emissão de DANFE-Se');

    // Validar dados obrigatórios
    if (!data.prestadorCnpj || !data.tomadorCpfCnpj || !data.servicoValor) {
      throw new Error('Dados obrigatórios faltando: CNPJ prestador, CPF/CNPJ tomador ou valor do serviço');
    }

    // Carregar certificado
    let certificateContent = data.certificateContent;
    if (!certificateContent && data.certificatePath) {
      certificateContent = fs.readFileSync(data.certificatePath, 'utf-8');
    }

    if (!certificateContent) {
      throw new Error('Certificado digital não encontrado');
    }

    // Criar instância do NFe
    const nfe = new NFe({
      cnpj: data.prestadorCnpj,
      inscricaoMunicipal: data.prestadorInscricaoMunicipal,
      razaoSocial: data.prestadorRazaoSocial,
      certificado: certificateContent,
      senhaCertificado: data.certificatePassword || '',
      ambiente: 'producao', // ou 'homologacao'
    });

    console.log('[NFSe Service] NFe configurado com sucesso');

    // Criar dados da NFS-e
    const nfseData = {
      tomador: {
        cpfCnpj: data.tomadorCpfCnpj.replace(/\D/g, ''),
        razaoSocial: data.tomadorRazaoSocial,
        endereco: {
          logradouro: data.tomadorLogradouro,
          numero: data.tomadorNumero,
          complemento: data.tomadorComplemento || '',
          bairro: data.tomadorBairro,
          cidade: data.tomadorCidade,
          estado: data.tomadorEstado,
          cep: data.tomadorCep.replace(/\D/g, ''),
        },
      },
      servico: {
        descricao: data.servicoDescricao,
        valor: data.servicoValor,
        aliquotaIss: data.servicoAliquotaIss,
        itemListaServico: data.servicoItemLista,
        deducoes: data.deducoes || 0,
        desconto: data.desconto || 0,
      },
      observacoes: data.observacoes || '',
    };

    console.log('[NFSe Service] Dados da NFS-e preparados');

    // Emitir NFS-e
    const resultado = await nfe.emitirNfse(nfseData);

    if (!resultado || !resultado.nfseNumber) {
      throw new Error('Falha ao emitir NFS-e: resposta inválida da Prefeitura');
    }

    console.log('[NFSe Service] NFS-e emitida com sucesso:', resultado.nfseNumber);

    return {
      success: true,
      nfseNumber: resultado.nfseNumber,
      protocolNumber: resultado.protocolNumber,
      xmlUrl: resultado.xmlUrl,
      pdfUrl: resultado.pdfUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[NFSe Service] Erro ao emitir NFS-e:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Consulta o status de uma NFS-e já emitida
 */
export async function consultarNfse(
  cnpj: string,
  inscricaoMunicipal: string,
  nfseNumber: string,
  certificateContent: string,
  certificatePassword?: string
): Promise<any> {
  try {
    const nfe = new NFe({
      cnpj,
      inscricaoMunicipal,
      certificado: certificateContent,
      senhaCertificado: certificatePassword || '',
      ambiente: 'producao',
    });

    const resultado = await nfe.consultarNfse(nfseNumber);
    return resultado;
  } catch (error) {
    console.error('[NFSe Service] Erro ao consultar NFS-e:', error);
    throw error;
  }
}

/**
 * Cancela uma NFS-e já emitida
 */
export async function cancelarNfse(
  cnpj: string,
  inscricaoMunicipal: string,
  nfseNumber: string,
  motivoCancelamento: string,
  certificateContent: string,
  certificatePassword?: string
): Promise<any> {
  try {
    const nfe = new NFe({
      cnpj,
      inscricaoMunicipal,
      certificado: certificateContent,
      senhaCertificado: certificatePassword || '',
      ambiente: 'producao',
    });

    const resultado = await nfe.cancelarNfse(nfseNumber, motivoCancelamento);
    return resultado;
  } catch (error) {
    console.error('[NFSe Service] Erro ao cancelar NFS-e:', error);
    throw error;
  }
}

/**
 * Gera o PDF da DANFE-Se
 */
export async function gerarDanfsePdf(
  nfseNumber: string,
  data: NfseEmissionData
): Promise<Buffer> {
  try {
    console.log('[NFSe Service] Gerando PDF da DANFE-Se:', nfseNumber);

    // Implementar geração de PDF aqui
    // Por enquanto, retornar um buffer vazio
    // Em produção, usar uma biblioteca como pdf-lib ou pdfkit

    return Buffer.from('PDF gerado com sucesso');
  } catch (error) {
    console.error('[NFSe Service] Erro ao gerar PDF:', error);
    throw error;
  }
}
