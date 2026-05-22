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

export default function History() {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Buscar histórico de notas fiscais
  const { data: invoices, isLoading } = trpc.nfe.getInvoiceHistory.useQuery();

  // Mutações
  const downloadPdfMutation = trpc.nfe.downloadPdf.useMutation();
  const consultarNfseMutation = trpc.nfe.consultarNfse.useMutation();
  const cancelarNfseMutation = trpc.nfe.cancelarNfse.useMutation();

  // Filtrar por status
  const filteredInvoices = invoices?.filter((inv: any) => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  }) || [];

  // Mapear status para cores
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'authorized': 'bg-green-100 text-green-800',
      'error': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Mapear status para label
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'processing': 'Processando',
      'authorized': 'Autorizada',
      'error': 'Erro',
      'cancelled': 'Cancelada',
    };
    return labels[status] || status;
  };

  // Baixar PDF
  const handleDownloadPdf = async (invoiceId: number) => {
    try {
      const result = await downloadPdfMutation.mutateAsync({ invoiceId });
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
    }
  };

  // Consultar NFS-e
  const handleConsultarNfse = async (invoiceId: number) => {
    try {
      const result = await consultarNfseMutation.mutateAsync({ invoiceId });
      setSelectedInvoice(result);
      setShowDetails(true);
    } catch (error) {
      console.error('Erro ao consultar NFS-e:', error);
    }
  };

  // Cancelar NFS-e
  const handleCancelarNfse = async (invoiceId: number) => {
    if (!confirm('Tem certeza que deseja cancelar esta nota fiscal?')) return;

    try {
      await cancelarNfseMutation.mutateAsync({
        invoiceId,
        justificativa: 'Cancelamento solicitado pelo usuário',
      });
      // Recarregar lista
      window.location.reload();
    } catch (error) {
      console.error('Erro ao cancelar NFS-e:', error);
    }
  };

  // Ver detalhes
  const handleViewDetails = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowDetails(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico de Emissões</h1>
        <p className="text-gray-600 mt-2">Consulte, baixe e cancele suas notas fiscais eletrônicas</p>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
          >
            Todas ({invoices?.length || 0})
          </Button>
          <Button
            variant={statusFilter === 'authorized' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('authorized')}
          >
            Autorizadas ({invoices?.filter((i: any) => i.status === 'authorized').length || 0})
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
          >
            Pendentes ({invoices?.filter((i: any) => i.status === 'pending').length || 0})
          </Button>
          <Button
            variant={statusFilter === 'error' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('error')}
          >
            Erros ({invoices?.filter((i: any) => i.status === 'error').length || 0})
          </Button>
          <Button
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('cancelled')}
          >
            Canceladas ({invoices?.filter((i: any) => i.status === 'cancelled').length || 0})
          </Button>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>NFS-e</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Nenhuma nota fiscal encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice: any) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {new Date(invoice.emittedAt || invoice.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{invoice.clientName}</TableCell>
                  <TableCell>R$ {invoice.serviceValue?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>{invoice.nfseNumber || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(invoice.status)}>
                      {getStatusLabel(invoice.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(invoice)}
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {invoice.pdfUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadPdf(invoice.id)}
                          title="Baixar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {invoice.status === 'authorized' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelarNfse(invoice.id)}
                          title="Cancelar"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Nota Fiscal</DialogTitle>
            <DialogDescription>
              NFS-e: {selectedInvoice?.nfseNumber || '-'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-sm">Cliente</label>
                <p>{selectedInvoice?.clientName}</p>
              </div>
              <div>
                <label className="font-semibold text-sm">CPF/CNPJ</label>
                <p>{selectedInvoice?.clientCpfCnpj}</p>
              </div>
              <div>
                <label className="font-semibold text-sm">Valor</label>
                <p>R$ {selectedInvoice?.serviceValue?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <label className="font-semibold text-sm">Status</label>
                <Badge className={getStatusColor(selectedInvoice?.status || '')}>
                  {getStatusLabel(selectedInvoice?.status || '')}
                </Badge>
              </div>
              <div>
                <label className="font-semibold text-sm">Data de Emissão</label>
                <p>{new Date(selectedInvoice?.emittedAt || selectedInvoice?.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <label className="font-semibold text-sm">Protocolo</label>
                <p>{selectedInvoice?.protocolNumber || '-'}</p>
              </div>
            </div>

            {selectedInvoice?.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800">{selectedInvoice.errorMessage}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {selectedInvoice?.pdfUrl && (
                <Button
                  onClick={() => window.open(selectedInvoice.pdfUrl, '_blank')}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
              )}
              {selectedInvoice?.status === 'authorized' && (
                <Button
                  variant="destructive"
                  onClick={() => handleCancelarNfse(selectedInvoice.id)}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
