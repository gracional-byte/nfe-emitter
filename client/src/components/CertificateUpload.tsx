import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export function CertificateUpload() {
  const [isLoading, setIsLoading] = useState(false);
  const [certificateName, setCertificateName] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  
  const certificatesQuery = trpc.nfe.getCertificates.useQuery();
  const uploadMutation = trpc.nfe.uploadCertificate.useMutation();
  const updateConfigMutation = trpc.nfe.updateCompanyConfig.useMutation();
  const utils = trpc.useUtils();

  const handleCertificateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.pem')) {
      setCertificateFile(file);
    } else {
      toast.error('Por favor, selecione um arquivo .pem válido');
    }
  };

  const handlePrivateKeySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.pem')) {
      setPrivateKeyFile(file);
    } else {
      toast.error('Por favor, selecione um arquivo .pem válido');
    }
  };

  const handleUpload = async () => {
    if (!certificateName.trim()) {
      toast.error('Por favor, preencha o nome do certificado');
      return;
    }

    if (!certificateFile) {
      toast.error('Por favor, selecione o arquivo de certificado público (.pem)');
      return;
    }

    if (!privateKeyFile) {
      toast.error('Por favor, selecione o arquivo de chave privada (.pem)');
      return;
    }

    setIsLoading(true);
    try {
      // Ler ambos os arquivos
      const certificateContent = await certificateFile.text();
      const privateKeyContent = await privateKeyFile.text();

      // Validar que são PEM válidos
      if (!certificateContent.includes('BEGIN CERTIFICATE')) {
        throw new Error('Arquivo de certificado não é um PEM válido');
      }
      if (!privateKeyContent.includes('BEGIN PRIVATE KEY') && !privateKeyContent.includes('BEGIN RSA PRIVATE KEY')) {
        throw new Error('Arquivo de chave privada não é um PEM válido');
      }

      const result = await uploadMutation.mutateAsync({
        certificateName: certificateName.trim(),
        certificateContent: certificateContent,
        certificatePassword: undefined,
        fileType: 'pem',
        privateKey: privateKeyContent,
      } as any);

      toast.success('Certificado enviado com sucesso!');

      // Se extraiu CNPJ, preencher automaticamente
      if (result.extractedCnpj) {
        try {
          await updateConfigMutation.mutateAsync({
            cnpj: result.extractedCnpj,
            inscricaoMunicipal: '',
            itemListaServico: '0101',
            codigoCnae: '9602502',
          });
          toast.success(`CNPJ preenchido automaticamente: ${result.extractedCnpj}`);
          await utils.nfe.getCompanyConfig.invalidate();
        } catch (error) {
          console.log('CNPJ extraído:', result.extractedCnpj, '- Configure manualmente se necessário');
        }
      }

      setCertificateName('');
      setCertificateFile(null);
      setPrivateKeyFile(null);

      // Refresh certificates list
      await utils.nfe.getCertificates.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar certificado';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Certificado Digital</CardTitle>
          <CardDescription>
            Faça upload de seu certificado digital em formato PEM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Como converter .pfx para .pem:</strong>
              <br />
              1. Certificado público: <code className="bg-white px-2 py-1 rounded">openssl pkcs12 -in arquivo.pfx -clcerts -nokeys -out certificado.pem</code>
              <br />
              2. Chave privada: <code className="bg-white px-2 py-1 rounded">openssl pkcs12 -in arquivo.pfx -nocerts -out chave.pem</code>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Certificado</label>
              <Input
                placeholder="Ex: Certificado Empresa 2024"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Certificado Público (.pem)</label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pem"
                  onChange={handleCertificateSelect}
                  disabled={isLoading}
                />
              </div>
              {certificateFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ Arquivo selecionado: {certificateFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Chave Privada (.pem)</label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pem"
                  onChange={handlePrivateKeySelect}
                  disabled={isLoading}
                />
              </div>
              {privateKeyFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ Arquivo selecionado: {privateKeyFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={isLoading || !certificateFile || !privateKeyFile || !certificateName.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar Certificado
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {certificatesQuery.data && certificatesQuery.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Certificados Cadastrados</CardTitle>
            <CardDescription>
              {certificatesQuery.data.length} certificado(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {certificatesQuery.data.map((cert) => {
                const isExpired = cert.expiresAt && new Date(cert.expiresAt) <= new Date();
                return (
                  <div
                    key={cert.id}
                    className={`p-4 border rounded-lg flex items-start justify-between ${
                      isExpired
                        ? 'bg-red-50 border-red-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isExpired ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        <p className={`font-medium ${isExpired ? 'text-red-800' : 'text-green-800'}`}>
                          {cert.certificateName}
                        </p>
                      </div>
                      <p className={`text-xs mt-1 font-mono ${isExpired ? 'text-red-700' : 'text-green-700'}`}>
                        {cert.thumbprint.substring(0, 32)}...
                      </p>
                      {cert.expiresAt && (
                        <p className={`text-xs mt-1 ${isExpired ? 'text-red-700' : 'text-green-700'}`}>
                          {isExpired ? 'Expirado em' : 'Válido até'}: {new Date(cert.expiresAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
