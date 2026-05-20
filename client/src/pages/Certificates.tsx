import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Certificates() {
  const [certificateName, setCertificateName] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const listCertificatesQuery = trpc.nfe.listCertificates.useQuery();
  const uploadCertificateMutation = trpc.nfe.uploadCertificate.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pem')) {
        toast.error('Por favor, selecione um arquivo .pem');
        return;
      }
      setCertificateFile(file);
    }
  };

  const handleUpload = async () => {
    if (!certificateName.trim()) {
      toast.error('Por favor, insira um nome para o certificado');
      return;
    }

    if (!certificateFile) {
      toast.error('Por favor, selecione um arquivo .pem');
      return;
    }

    setIsUploading(true);
    try {
      const content = await certificateFile.text();
      await uploadCertificateMutation.mutateAsync({
        certificateName,
        certificateContent: content,
      });

      toast.success('Certificado enviado com sucesso!');
      setCertificateName('');
      setCertificateFile(null);
      listCertificatesQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar certificado';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certificados Digitais</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie seus certificados digitais (chaves privadas PEM) para assinatura de notas fiscais.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Novo Certificado</CardTitle>
          <CardDescription>
            Faça upload de um certificado digital em formato PEM (.pem)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cert-name">Nome do Certificado</Label>
              <Input
                id="cert-name"
                placeholder="Ex: Certificado Principal 2024"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cert-file">Arquivo PEM</Label>
              <Input
                id="cert-file"
                type="file"
                accept=".pem"
                onChange={handleFileChange}
              />
              {certificateFile && (
                <p className="text-sm text-green-600">
                  ✓ Arquivo selecionado: {certificateFile.name}
                </p>
              )}
            </div>

            <Button onClick={handleUpload} disabled={isUploading} className="w-full">
              {isUploading ? (
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

      <Card>
        <CardHeader>
          <CardTitle>Certificados Ativos</CardTitle>
          <CardDescription>
            Lista de certificados digitais disponíveis para emissão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listCertificatesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : listCertificatesQuery.data && listCertificatesQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Expira em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listCertificatesQuery.data.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      {cert.certificateName}
                    </TableCell>
                    <TableCell>
                      {cert.isActive ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(cert.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {cert.expiresAt
                        ? new Date(cert.expiresAt).toLocaleDateString('pt-BR')
                        : 'Não definido'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum certificado enviado ainda. Envie um certificado para começar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
