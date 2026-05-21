import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, TrendingUp, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { trpc } from '@/lib/trpc';

export default function Dashboard() {
  const statsQuery = trpc.nfe.getInvoiceStats.useQuery();
  const invoicesQuery = trpc.nfe.getInvoices.useQuery();
  const configQuery = trpc.nfe.getCompanyConfig.useQuery();

  const stats = statsQuery.data || { total: 0, thisMonth: 0, totalValue: 0 };
  const config = configQuery.data;
  const invoices = invoicesQuery.data || [];

  // Gerar dados dos últimos 7 dias com dados reais
  const chartData = useMemo(() => {
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map((date) => {
      const dateStr = date.toISOString().split('T')[0];
      const count = invoices.filter((inv) => {
        const invDate = new Date(inv.serviceDate).toISOString().split('T')[0];
        return invDate === dateStr;
      }).length;

      return {
        date: date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        notas: count,
      };
    });
  }, [invoices]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Resumo das emissões de DANFE-Se
        </p>
      </div>

      {/* Cards de Estatísticas - Carrega independentemente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Notas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  DANFE-Se autorizadas
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.thisMonth}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  DANFE-Se emitidas este mês
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  R$ {(stats.totalValue || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor total emitido
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico - Carrega independentemente */}
      <Card>
        <CardHeader>
          <CardTitle>Emissões por Período</CardTitle>
          <CardDescription>
            Gráfico de emissões dos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesQuery.isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="notas" stroke="#3b82f6" name="DANFE-Se Emitidas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Informações da Empresa - Carrega independentemente */}
      {configQuery.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </CardContent>
        </Card>
      ) : config ? (
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
      ) : null}
    </div>
  );
}
