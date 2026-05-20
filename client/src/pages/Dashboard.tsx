import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, TrendingUp, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const statsQuery = trpc.nfe.getInvoiceStats.useQuery();
  const configQuery = trpc.nfe.getCompanyConfig.useQuery();

  if (statsQuery.isLoading || configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const stats = statsQuery.data || { total: 0, thisMonth: 0, totalValue: 0 };
  const config = configQuery.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Resumo das emissões de notas fiscais
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Notas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Notas fiscais autorizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Notas emitidas este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor total emitido
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emissões por Período</CardTitle>
          <CardDescription>
            Gráfico de emissões dos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { date: '1', notas: 2 },
              { date: '2', notas: 3 },
              { date: '3', notas: 2 },
              { date: '4', notas: 5 },
              { date: '5', notas: 4 },
              { date: '6', notas: 6 },
              { date: '7', notas: 3 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="notas" stroke="#3b82f6" name="Notas Emitidas" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
            <CardDescription>
              Dados tributários configurados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">CNPJ</p>
                <p className="text-lg font-semibold">{config.cnpj}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inscrição Municipal</p>
                <p className="text-lg font-semibold">{config.inscricaoMunicipal}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Item Lista Serviço</p>
                <p className="text-lg font-semibold">{config.itemListaServico}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Código CNAE</p>
                <p className="text-lg font-semibold">{config.codigoCnae}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Regime Tributário</p>
                <p className="text-lg font-semibold">{config.regimeEspecialTributacao}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Simples Nacional</p>
                <p className="text-lg font-semibold">
                  {config.optanteSimplesNacional === '1' ? 'Sim' : 'Não'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
