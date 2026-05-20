import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Send, AlertCircle } from 'lucide-react';
import { isValidCPFOrCNPJ } from '@/lib/validation';
import { CertificateSelector } from '@/components/CertificateSelector';


const EmitRpsSchema = z.object({
  clientName: z.string().min(1, 'Nome do cliente obrigatório'),
  clientCpfCnpj: z.string().min(11, 'CPF ou CNPJ inválido').refine(isValidCPFOrCNPJ, 'CPF ou CNPJ inválido'),
  clientAddress: z.string().min(1, 'Endereço obrigatório'),
  clientCity: z.string(),
  clientState: z.string(),
  clientCep: z.string(),
  serviceDescription: z.string().min(1, 'Descrição do serviço obrigatória'),
  serviceValue: z.string().min(1, 'Valor obrigatório'),
  deductions: z.string(),
  observations: z.string().optional(),
});

type EmitRpsFormData = z.infer<typeof EmitRpsSchema>;

export default function EmitRps() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const getConfigQuery = trpc.nfe.getConfig.useQuery();
  const emitRpsMutation = trpc.nfe.emitRps.useMutation();

  const form = useForm<EmitRpsFormData>({
    resolver: zodResolver(EmitRpsSchema),
    defaultValues: {
      clientName: '',
      clientCpfCnpj: '',
      clientAddress: '',
      clientCity: 'São Paulo',
      clientState: 'SP',
      clientCep: '',
      serviceDescription: '',
      serviceValue: '',
      deductions: '0',
      observations: '',
    },
  });

  async function onSubmit(data: EmitRpsFormData) {
    if (!getConfigQuery.data) {
      toast.error('Configurações da empresa não encontradas. Configure os dados tributários primeiro.');
      return;
    }

    setIsLoading(true);
    try {
      await emitRpsMutation.mutateAsync(data);
      toast.success('RPS emitido com sucesso!');
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao emitir RPS';
      toast.error(message);
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

  if (!getConfigQuery.data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emitir RPS</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você precisa configurar os dados tributários da empresa antes de emitir notas fiscais.
            Acesse as configurações para continuar.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Seletor de Certificado */}
      <Card>
        <CardHeader>
          <CardTitle>1. Selecione seu Certificado Digital</CardTitle>
          <CardDescription>Escolha o certificado digital instalado no seu computador</CardDescription>
        </CardHeader>
        <CardContent>
          <CertificateSelector onCertificateSelected={setSelectedCert} />
        </CardContent>
      </Card>

      {!selectedCert && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecione um certificado digital para continuar
          </AlertDescription>
        </Alert>
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Emitir RPS</h1>
        <p className="text-muted-foreground mt-2">
          Preencha os dados do cliente e do serviço para emitir uma nova nota fiscal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Cliente</CardTitle>
          <CardDescription>
            Informações do tomador do serviço
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome/Razão Social</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientCpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF ou CNPJ</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                          {...field}
                          onChange={(e) => {
                            // Remove caracteres não numéricos para validação
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientAddress"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, complemento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientCep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input placeholder="01001000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Dados do Serviço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="serviceDescription"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Descrição do Serviço</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva o serviço prestado"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do Serviço (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deductions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deduções (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Opcional: descontos ou deduções
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informações adicionais (opcional)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Configurações tributárias:</strong> Os dados de tributação (Item Lista Serviço, Código CNAE, etc.) serão preenchidos automaticamente com os valores configurados na empresa.
                </p>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Emitindo RPS...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Emitir RPS
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
