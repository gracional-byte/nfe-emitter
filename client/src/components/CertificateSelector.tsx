import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface CertificateInfo {
  name: string;
  thumbprint: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
}

interface CertificateSelectorProps {
  onCertificateSelected?: (cert: CertificateInfo) => void;
}

export function CertificateSelector({ onCertificateSelected }: CertificateSelectorProps) {
  const [selectedCert, setSelectedCert] = useState<CertificateInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectCertificate = async () => {
    try {
      setLoading(true);

      // Simular seleção de certificado
      const mockCert: CertificateInfo = {
        name: 'VIBE TERAPIAS INTEGRATIVAS LTDA',
        thumbprint: '0F8D2F7E5FA8AF0B2620DFCCEE4430DB8852487A',
        issuer: 'Autoridade Certificadora',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2025-01-01'),
      };

      setSelectedCert(mockCert);
      onCertificateSelected?.(mockCert);
      toast.success('Certificado selecionado com sucesso!');
    } catch (error) {
      toast.error('Erro ao selecionar certificado');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleSelectCertificate}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Selecionando certificado...
          </>
        ) : (
          'Selecionar Certificado Digital'
        )}
      </Button>

      {selectedCert && (
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">✓ Certificado Selecionado</p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">Nome:</dt>
                  <dd>{selectedCert.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">Thumbprint:</dt>
                  <dd className="font-mono">{selectedCert.thumbprint.substring(0, 16)}...</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">Válido até:</dt>
                  <dd>{selectedCert.validTo.toLocaleDateString('pt-BR')}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
