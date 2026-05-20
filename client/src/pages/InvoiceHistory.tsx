import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Download, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InvoiceHistory() {
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showXmlDialog, setShowXmlDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const listInvoicesQuery = trpc.nfe.getInvoices.useQuery({ limit: 20, offset: (page - 1) * 20 });

  const handleDownloadXml = async (invoice: any): Promise<void> => {
    if (!invoice.xmlSignedUrl) {
      toast.error('XML não disponível para download');
      return;
    }

    try {
      const response = await fetch(invoice.xmlSignedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RPS_${invoice.rpsNumber}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('XML baixado com sucesso');
    } catch (error) {
      toast.error('Erro ao baixar XML');
    }
  };

  const handleViewXml = (invoice: any): void => {
    setSelectedInvoice(invoice);
    setShowXmlDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'authorized':
        return (
          <Badge className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Autorizada
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico de Notas Fiscais</h1>
        <p className="text-muted-foreground mt-2">
          Visualize e gerencie todas as notas fiscais emitidas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notas Fiscais Emitidas</CardTitle>
          <CardDescription>
            Lista completa de RPS/NFS-e emitidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="text-sm font-medium">Buscar por cliente</label>
              <input
                type="text"
                placeholder="Nome ou CPF/CNPJ"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Filtrar por status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="authorized">Autorizada</option>
                <option value="error">Erro</option>
                <option value="pending">Pendente</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
          {listInvoicesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : listInvoicesQuery.data && listInvoicesQuery.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RPS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listInvoicesQuery.data
                      .filter((invoice) => {
                        const matchesSearch = searchTerm === '' || 
                          invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          invoice.clientCpfCnpj.includes(searchTerm);
                        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.rpsNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invoice.clientName}</p>
                            <p className="text-sm text-muted-foreground">{invoice.clientCpfCnpj}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          R$ {parseFloat(invoice.serviceValue).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          {new Date(invoice.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewXml(invoice)}
                              title="Visualizar XML"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadXml(invoice)}
                              title="Baixar XML"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Página {page}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={!listInvoicesQuery.data || listInvoicesQuery.data.length < 20}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma nota fiscal emitida ainda.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showXmlDialog} onOpenChange={setShowXmlDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>XML Assinado - RPS {selectedInvoice?.rpsNumber}</DialogTitle>
            <DialogDescription>
              Visualização do XML assinado digitalmente
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice?.xmlSignedUrl && (
            <div className="bg-slate-100 p-4 rounded-lg overflow-auto max-h-[60vh]">
              <pre className="text-xs whitespace-pre-wrap break-words">
                Carregando XML...
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
