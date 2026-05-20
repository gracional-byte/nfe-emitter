import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const CompanyConfigSchema = z.object({
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
  inscricaoMunicipal: z.string().min(1, 'Inscrição municipal obrigatória'),
  itemListaServico: z.string().default('0101'),
  codigoCnae: z.string().default('9602502'),
  regimeEspecialTributacao: z.string().default('1'),
  optanteSimplesNacional: z.string().default('1'),
  incentivadorCultural: z.string().default('2'),
});

type CompanyConfigFormData = z.infer<typeof CompanyConfigSchema>;

export default function Settings() {
  const [isLoading, setIsLoading] = useState(false);
  const getConfigQuery = trpc.nfe.getConfig.useQuery();
  const updateConfigMutation = trpc.nfe.updateConfig.useMutation();

  const form = useForm<CompanyConfigFormData>({
    resolver: zodResolver(CompanyConfigSchema) as any,
    defaultValues: {
      cnpj: '',
      inscricaoMunicipal: '',
      itemListaServico: '0101',
      codigoCnae: '9602502',
      regimeEspecialTributacao: '1',
      optanteSimplesNacional: '1',
      incentivadorCultural: '2',
    },
  });

  useEffect(() => {
    if (getConfigQuery.data) {
      form.reset({
        cnpj: getConfigQuery.data.cnpj || '',
        inscricaoMunicipal: getConfigQuery.data.inscricaoMunicipal || '',
        itemListaServico: getConfigQuery.data.itemListaServico || '0101',
        codigoCnae: getConfigQuery.data.codigoCnae || '9602502',
        regimeEspecialTributacao: getConfigQuery.data.regimeEspecialTributacao || '1',
        optanteSimplesNacional: getConfigQuery.data.optanteSimplesNacional || '1',
        incentivadorCultural: getConfigQuery.data.incentivadorCultural || '2',
      });
    }
  }, [getConfigQuery.data, form]);

  async function onSubmit(data: CompanyConfigFormData) {
    setIsLoading(true);
    try {
      await updateConfigMutation.mutateAsync(data);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsLoading(false);
    }
  }

  if (getConfigQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações da Empresa</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie os dados tributários padrão que serão utilizados na emissão de notas fiscais.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados Tributários</CardTitle>
          <CardDescription>
            Estes dados serão pré-preenchidos em cada emissão de RPS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inscricaoMunicipal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Municipal</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemListaServico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Lista Serviço</FormLabel>
                      <FormControl>
                        <Input placeholder="0101" {...field} />
                      </FormControl>
                      <FormDescription>
                        Código da lista de serviços da prefeitura
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="codigoCnae"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código CNAE</FormLabel>
                      <FormControl>
                        <Input placeholder="9602502" {...field} />
                      </FormControl>
                      <FormDescription>
                        Código de Classificação Nacional de Atividades Econômicas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="regimeEspecialTributacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regime Especial Tributação</FormLabel>
                      <FormControl>
                        <Input placeholder="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="optanteSimplesNacional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Optante Simples Nacional</FormLabel>
                      <FormControl>
                        <Input placeholder="1" {...field} />
                      </FormControl>
                      <FormDescription>
                        1 = Sim, 2 = Não
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incentivadorCultural"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incentivador Cultural</FormLabel>
                      <FormControl>
                        <Input placeholder="2" {...field} />
                      </FormControl>
                      <FormDescription>
                        1 = Sim, 2 = Não
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
