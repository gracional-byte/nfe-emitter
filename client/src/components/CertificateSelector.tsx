import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CertificateInfo {
  id: number;
  certificateName: string;
  thumbprint: string;
  expiresAt: Date | null;
}

interface CertificateSelectorProps {
  onCertificateSelected?: (cert: CertificateInfo) => void;
}

export function CertificateSelector({ onCertificateSelected }: CertificateSelectorProps) {
  const [selectedCert, setSelectedCert] = useState<CertificateInfo | null>(null);
  const certificatesQuery = trpc.nfe.getCertificates.useQuery();

  // Auto-select the first valid certificate
  useEffect(() => {
    if (certificatesQuery.data && certificatesQuery.data.length > 0 && !selectedCert) {
      const validCerts = certificatesQuery.data.filter(cert => {
        if (!cert.expiresAt) return true;
        const expiresAt = new Date(cert.expiresAt);
        return expiresAt > new Date();
      });

      if (validCerts.length > 0) {
        const firstCert = validCerts[0];
        const cert: CertificateInfo = {
          id: firstCert.id,
          certificateName: firstCert.certificateName,
          thumbprint: firstCert.thumbprint,
          expiresAt: firstCert.expiresAt ? new Date(firstCert.expiresAt) : null,
        };
        setSelectedCert(cert);
        onCertificateSelected?.(cert);
      }
    }
  }, [certificatesQuery.data, selectedCert, onCertificateSelected]);

  const handleSelectCertificate = (certId: string) => {
    const cert = certificatesQuery.data?.find(c => c.id === parseInt(certId));
    if (cert) {
      const certificateInfo: CertificateInfo = {
        id: cert.id,
        certificateName: cert.certificateName,
        thumbprint: cert.thumbprint,
        expiresAt: cert.expiresAt ? new Date(cert.expiresAt) : null,
      };
      setSelectedCert(certificateInfo);
      onCertificateSelected?.(certificateInfo);
      toast.success('Certificado selecionado com sucesso!');
    }
  };

  if (certificatesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-gray-100 rounded">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-gray-600">Carregando certificados...</span>
        </div>
      </div>
    );
  }

  if (certificatesQuery.isError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-600">Erro ao carregar certificados</span>
        </div>
      </div>
    );
  }

  const validCerts = certificatesQuery.data?.filter(cert => {
    if (!cert.expiresAt) return true;
    const expiresAt = new Date(cert.expiresAt);
    return expiresAt > new Date();
  }) || [];

  const expiredCerts = certificatesQuery.data?.filter(cert => {
    if (!cert.expiresAt) return false;
    const expiresAt = new Date(cert.expiresAt);
    return expiresAt <= new Date();
  }) || [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Certificado Digital</label>
        <Select value={selectedCert?.id.toString() || ''} onValueChange={handleSelectCertificate}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um certificado" />
          </SelectTrigger>
          <SelectContent>
            {validCerts.length > 0 && (
              <>
                {validCerts.map(cert => (
                  <SelectItem key={cert.id} value={cert.id.toString()}>
                    {cert.certificateName} 
                    {cert.expiresAt && ` (Válido até ${new Date(cert.expiresAt).toLocaleDateString('pt-BR')})`}
                  </SelectItem>
                ))}
              </>
            )}
            {expiredCerts.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                  Certificados Expirados
                </div>
                {expiredCerts.map(cert => (
                  <SelectItem key={cert.id} value={cert.id.toString()} disabled>
                    {cert.certificateName} 
                    {cert.expiresAt && ` (Expirado em ${new Date(cert.expiresAt).toLocaleDateString('pt-BR')})`}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedCert && (
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">✓ Certificado Selecionado</p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">Nome:</dt>
                  <dd>{selectedCert.certificateName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">Thumbprint:</dt>
                  <dd className="font-mono">{selectedCert.thumbprint.substring(0, 16)}...</dd>
                </div>
                {selectedCert.expiresAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="font-medium">Válido até:</dt>
                    <dd>{selectedCert.expiresAt.toLocaleDateString('pt-BR')}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Card>
      )}

      {validCerts.length === 0 && (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-600">Nenhum certificado válido disponível</span>
        </div>
      )}
    </div>
  );
}
