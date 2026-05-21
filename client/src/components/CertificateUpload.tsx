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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [certificateName, setCertificateName] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
  const [fileType, setFileType] = useState<'pem' | 'pfx'>('pem');
  const certificatesQuery = trpc.nfe.getCertificates.useQuery();
  const uploadMutation = trpc.nfe.uploadCertificate.useMutation();
  const updateConfigMutation = trpc.nfe.updateCompanyConfig.useMutation();
  const utils = trpc.useUtils();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPem = file.name.endsWith('.pem');
      const isPfx = file.name.endsWith('.pfx') || file.name.endsWith('.p12');
      
      if (!isPem && !isPfx) {
        toast.error('Por favor, selecione um arquivo .pem ou .pfx válido');
        return;
      }
      
      setFileType(isPfx ? 'pfx' : 'pem');
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !certificateName.trim()) {
      toast.error('Por favor, preencha o nome e selecione um arquivo');
      return;
    }

    if (fileType === 'pfx' && !certificatePassword.trim()) {
      toast.error('Por favor, informe a senha do certificado .pfx');
      return;
    }

    setIsLoading(true);
    try {
      let fileContent: string;
      
      if (fileType === 'pfx') {
        // Para .pfx, converter para Base64
        const buffer = await selectedFile.arrayBuffer();
        fileContent = Buffer.from(buffer).toString('base64');
      } else {
        // Para .pem, ler como texto
        fileContent = await selectedFile.text();
      }
      
      const result = await uploadMutation.mutateAsync({
        certificateName: certificateName.trim(),
        certificateContent: fileContent,
        certificatePassword: fileType === 'pfx' ? certificatePassword : undefined,
        fileType,
      });

      toast.success('Certificado enviado com sucesso!');
      
      // Se extraiu CNPJ, preencher automaticamente
      if (result.extractedCnpj) {
        try {
          const config = await trpc.nfe.getCompanyConfig.useQuery().data;
          if (config) {
            await updateConfigMutation.mutateAsync({
              cnpj: result.extractedCnpj,
              inscricaoMunicipal: config.inscricaoMunicipal || '',
              itemListaServico: config.itemListaServico || '',
              codigoCnae: config.codigoCnae || '',
            });
            toast.success(`CNPJ preenchido automaticamente: ${result.extractedCnpj}`);
          }
        } catch (error) {
          console.log('CNPJ extraído:', result.extractedCnpj, '- Configure manualmente se necessário');
        }
      }
      
      setSelectedFile(null);
      setCertificateName('');
      setCertificatePassword('');
      
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
            Faça upload do seu certificado digital em formato .pem ou .pfx
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              O certificado digital é necessário para assinar as notas fiscais. Você pode obter um certificado junto a uma Autoridade Certificadora (AC) credenciada pela ICP-Brasil.
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
              <label className="text-sm font-medium">Arquivo (.pem ou .pfx)</label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pem,.pfx,.p12"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                />
              </div>
              {selectedFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ Arquivo selecionado: {selectedFile.name}
                </p>
              )}
            </div>

            {fileType === 'pfx' && (
              <div>
                <label className="text-sm font-medium">Senha do Certificado .pfx</label>
                <Input
                  type="password"
                  placeholder="Digite a senha do certificado"
                  value={certificatePassword}
                  onChange={(e) => setCertificatePassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={isLoading || !selectedFile || !certificateName.trim() || (fileType === 'pfx' && !certificatePassword.trim())}
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
