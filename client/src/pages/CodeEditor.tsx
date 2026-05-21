import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const FILES_AVAILABLE = [
  { path: 'server/routers/nfe.ts', label: 'Routers NFe' },
  { path: 'server/nfe-service.ts', label: 'Serviço NFe' },
  { path: 'client/src/pages/EmitRps.tsx', label: 'Página Emitir DANFE-Se' },
  { path: 'client/src/pages/Dashboard.tsx', label: 'Dashboard' },
];

export default function CodeEditor() {
  const [selectedFile, setSelectedFile] = useState('server/routers/nfe.ts');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const editFileMutation = trpc.system.editFile.useMutation();
  const readFileMutation = trpc.system.readFile.useMutation();

  const EDITOR_PASSWORD = 'admin123'; // Você pode mudar isso

  const handleLogin = () => {
    if (password === EDITOR_PASSWORD) {
      setIsAuthenticated(true);
      toast.success('Autenticado com sucesso!');
      loadFile();
    } else {
      toast.error('Senha incorreta');
    }
  };

  const loadFile = async () => {
    setLoading(true);
    try {
      const result = await readFileMutation.mutateAsync({ filePath: selectedFile });
      setContent(result.content);
    } catch (error) {
      toast.error('Erro ao carregar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    setLoading(true);
    try {
      await editFileMutation.mutateAsync({
        filePath: selectedFile,
        content,
      });
      toast.success('Arquivo salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar arquivo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFile();
    }
  }, [selectedFile, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Editor de Código</h1>
          <p className="text-sm text-slate-600 mb-4 text-center">
            Acesso restrito. Digite a senha para continuar.
          </p>
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="mb-4"
          />
          <Button onClick={handleLogin} className="w-full">
            Entrar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">Editor de Código</h1>
          
          <div className="flex gap-4 mb-4">
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILES_AVAILABLE.map((file) => (
                  <SelectItem key={file.path} value={file.path}>
                    {file.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button onClick={loadFile} variant="outline" disabled={loading}>
              {loading ? 'Carregando...' : 'Recarregar'}
            </Button>
            
            <Button onClick={saveFile} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="font-mono text-sm min-h-96 resize-none"
            placeholder="Carregue um arquivo para começar..."
          />
        </Card>

        <div className="mt-4 text-sm text-slate-600">
          <p>📝 Arquivo selecionado: <code className="bg-slate-100 px-2 py-1 rounded">{selectedFile}</code></p>
          <p>💾 As mudanças serão salvas no servidor automaticamente.</p>
        </div>
      </div>
    </div>
  );
}
