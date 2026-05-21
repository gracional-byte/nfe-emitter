declare module 'node-nfe' {
  export interface NFeConfig {
    cnpj: string;
    inscricaoMunicipal: string;
    razaoSocial?: string;
    certificado: string;
    senhaCertificado: string;
    ambiente: 'producao' | 'homologacao';
  }

  export interface NFseEmissionData {
    tomador: {
      cpfCnpj: string;
      razaoSocial: string;
      endereco: {
        logradouro: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        estado: string;
        cep: string;
      };
    };
    servico: {
      descricao: string;
      valor: number;
      aliquotaIss: number;
      itemListaServico: string;
      deducoes?: number;
      desconto?: number;
    };
    observacoes?: string;
  }

  export interface NFseEmissionResult {
    nfseNumber: string;
    protocolNumber: string;
    xmlUrl?: string;
    pdfUrl?: string;
  }

  export class NFe {
    constructor(config: NFeConfig);
    emitirNfse(data: NFseEmissionData): Promise<NFseEmissionResult>;
    consultarNfse(nfseNumber: string): Promise<any>;
    cancelarNfse(nfseNumber: string, motivo: string): Promise<any>;
  }
}
