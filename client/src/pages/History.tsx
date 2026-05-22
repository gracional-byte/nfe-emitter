import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

export function History() {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Buscar histórico de notas fiscais
  const { data: invoices, isLoading, refetch } = trpc.nfe.getInvoices.useQuery();

  // Mutation para download de PDF
  const downloadPdfMutation = trpc.nfe.downloadPdf.useQuery(
    selectedInvoice ? { invoiceId: selectedInvoice.id } : undefined,
    { enabled: false }
  );

  // Mutation para consultar NFS-e
  const consultarNfseMutation = trpc.nfe.consultarNfse.useMutation();

  // Mutation para cancelar NFS-e
  const cancelarNfseMutation = trpc.nfe.cancelarNfse.useMutation();

  const handleDownloadPdf = async (invoice: any) => {
    try {
      const result = await downloadPdfMutation.refetch();
      if (result.data?.pdfUrl) {
        // Abrir em nova aba
        window.open(result.data.pdfUrl, '_blank');
      }
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
    }
  };

  const handleConsultarNfse = async (invoiceId: number) => {
    try {
      await consultarNfseMutation.mutateAsync({ invoiceId });
      refetch();
    } catch (error) {
      console.error('Erro ao consultar NFS-e:', error);
    }
  };

  const handleCancelarNfse = async (invoiceId: number) => {
    if (confirm('Tem certeza que deseja cancelar esta nota fiscal?')) {
      try {
        await cancelarNfseMutation.mutateAsync({
          invoiceId,
          justificativa: 'Cancelamento solicitado pelo usuário',
        });
        refetch();
      } catch (error) {
        console.error('Erro ao cancelar NFS-e:', error);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      processing: { label: 'Processando', variant: 'secondary' },
      authorized: { label: 'Autorizada', variant: 'default' },
      error: { label: 'Erro', variant: 'destructive' },
      cancelled: { label: 'Cancelada', variant: 'outline' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: any) => {
    if (!value) return 'R$ 0,00';
    return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Emissões</h1>
          <p className="text-muted-foreground mt-2">
            Visualize todas as notas fiscais eletrônicas emitidas
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !invoices || (Array.isArray(invoices) && invoices.length === 0) ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Nenhuma nota fiscal emitida ainda</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NFS-e</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Emissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(invoices) ? invoices : [invoices]).map((invoice: any) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">
                      {invoice.nfseNumber || 'Pendente'}
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{formatCurrency(invoice.serviceValue)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>{formatDate(invoice.emittedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowDetails(true);
                          }}
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {invoice.pdfUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadPdf(invoice)}
                            title="Baixar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}

                        {invoice.status !== 'cancelled' && invoice.nfseNumber && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelarNfse(invoice.id)}
                            title="Cancelar"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Dialog de Detalhes */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Nota Fiscal</DialogTitle>
              <DialogDescription>
                NFS-e {selectedInvoice?.nfseNumber || 'Pendente'}
              </DialogDescription>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-semibold">{selectedInvoice.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                    <p className="font-mono">{selectedInvoice.clientCpfCnpj}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor do Serviço</p>
                    <p className="font-semibold">{formatCurrency(selectedInvoice.serviceValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ISS</p>
                    <p className="font-semibold">{formatCurrency(selectedInvoice.issValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p>{getStatusBadge(selectedInvoice.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Emissão</p>
                    <p className="font-semibold">{formatDate(selectedInvoice.emittedAt)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Descrição do Serviço</p>
                  <p className="font-semibold">{selectedInvoice.serviceDescription}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-semibold">
                    {selectedInvoice.clientAddress}, {selectedInvoice.clientCity} - {selectedInvoice.clientState}
                  </p>
                </div>

                {selectedInvoice.protocolNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Protocolo</p>
                    <p className="font-mono">{selectedInvoice.protocolNumber}</p>
                  </div>
                )}

                {selectedInvoice.errorMessage && (
                  <div className="bg-destructive/10 p-3 rounded text-sm text-destructive">
                    {selectedInvoice.errorMessage}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {selectedInvoice.pdfUrl && (
                    <Button
                      onClick={() => window.open(selectedInvoice.pdfUrl, '_blank')}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar PDF
                    </Button>
                  )}

                  {selectedInvoice.status !== 'cancelled' && selectedInvoice.nfseNumber && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleCancelarNfse(selectedInvoice.id);
                        setShowDetails(false);
                      }}
                      className="flex-1"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Cancelar NFS-e
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
