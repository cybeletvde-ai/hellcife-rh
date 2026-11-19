import React, { useState } from 'react';
import { Info, Megaphone, Paperclip, Plus, Upload } from 'lucide-react';
import { Atestado, AvisoEmpresa, Colaborador, Unidade, temPermissaoGestao } from '../../types/rh';
import { formatBRL, formatDateBR, getTodayStr } from '../../utils/cltCalculations';

interface AtestadosViewProps {
  colaborador: Colaborador;
  atestados: Atestado[];
  onAdicionarAtestado: (novo: Atestado) => Promise<boolean>;
}

export const AtestadosView: React.FC<AtestadosViewProps> = ({
  colaborador,
  atestados,
  onAdicionarAtestado,
}) => {
  const [tipo, setTipo] = useState<'Atestado Médico' | 'Justificativa de Atraso'>('Atestado Médico');
  const [dataInicio, setDataInicio] = useState(getTodayStr);
  const [dataFim, setDataFim] = useState(getTodayStr);
  const [minutosAbonados, setMinutosAbonados] = useState('30');
  const [motivo, setMotivo] = useState('');
  const [anexoNome, setAnexoNome] = useState<string | undefined>();
  const [anexoDataUrl, setAnexoDataUrl] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState('');

  const meusAtestados = atestados
    .filter((a) => a.colaboradorId === colaborador.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnexoNome(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAnexoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return;

    const novo: Atestado = {
      id: `at-${Date.now()}`,
      colaboradorId: colaborador.id,
      tipo,
      dataInicio,
      dataFim: tipo === 'Justificativa de Atraso' ? dataInicio : dataFim,
      minutosAbonados:
        tipo === 'Justificativa de Atraso' ? Math.max(0, parseInt(minutosAbonados, 10) || 0) : undefined,
      motivo: motivo.trim(),
      anexoNome,
      anexoDataUrl,
      status: 'Pendente',
      criadoEm: new Date().toISOString(),
    };

    const ok = await onAdicionarAtestado(novo);
    if (ok) {
      setMotivo('');
      setAnexoNome(undefined);
      setAnexoDataUrl(undefined);
      setSucesso('Solicitação enviada para análise do RH.');
      setTimeout(() => setSucesso(''), 3500);
    }
  };

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-2.5">
          <Paperclip className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h1 className="text-sm font-bold">Atestados & Justificativas</h1>
        </div>

        {sucesso && (
          <div className="mb-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {sucesso}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {(['Atestado Médico', 'Justificativa de Atraso'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  tipo === t
                    ? 'border-[#DC2626] bg-red-50 dark:bg-red-950/30 text-[#DC2626]'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                {tipo === 'Atestado Médico' ? 'Data início' : 'Data do ocorrido'}
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            {tipo === 'Atestado Médico' ? (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Data fim
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Minutos a abonar
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={minutosAbonados}
                  onChange={(e) => setMinutosAbonados(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Descrição / Motivo
            </label>
            <textarea
              rows={2}
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo ou CID (opcional)..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:border-[#DC2626]"
            />
          </div>

          <div>
            <label className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer hover:border-[#DC2626]">
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{anexoNome || 'Anexar foto ou PDF do atestado'}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
          >
            ENVIAR PARA ANÁLISE
          </button>
        </form>
      </section>

      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Minhas Solicitações
        </h2>
        {meusAtestados.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
            Nenhum atestado ou justificativa enviado.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2">
            {meusAtestados.map((a) => (
              <div key={a.id} className="pt-2 first:pt-0 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{a.tipo}</span>
                  <span
                    className={`font-semibold ${
                      a.status === 'Aprovado'
                        ? 'text-emerald-600'
                        : a.status === 'Recusado'
                          ? 'text-red-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {formatDateBR(a.dataInicio)}
                  {a.dataFim !== a.dataInicio ? ` até ${formatDateBR(a.dataFim)}` : ''}
                  {a.minutosAbonados ? ` · ${a.minutosAbonados} min` : ''}
                </div>
                <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{a.motivo}</p>
                {a.anexoDataUrl && a.anexoDataUrl.startsWith('data:image') && (
                  <img
                    src={a.anexoDataUrl}
                    alt={a.anexoNome || 'Anexo'}
                    className="mt-1.5 max-h-28 rounded-lg border border-zinc-200 dark:border-zinc-700 object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface InformacoesViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  avisos: AvisoEmpresa[];
  onAdicionarAviso: (aviso: AvisoEmpresa) => Promise<boolean>;
}

export const InformacoesView: React.FC<InformacoesViewProps> = ({
  colaborador,
  unidadeAtiva,
  avisos,
  onAdicionarAviso,
}) => {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const isGestor = temPermissaoGestao(colaborador.funcao);

  const avisosVisiveis = avisos
    .filter((av) => av.unidadeAlvo === 'Todas' || av.unidadeAlvo === unidadeAtiva)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const handlePublicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) return;
    const ok = await onAdicionarAviso({
      id: `av-${Date.now()}`,
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      unidadeAlvo: 'Todas',
      criadoEm: new Date().toISOString(),
      autorNome: colaborador.nome,
    });
    if (ok) {
      setTitulo('');
      setMensagem('');
      setMostrarForm(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-2.5">
          <Info className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h1 className="text-sm font-bold">Meus Dados Cadastrais</h1>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Nome</span>
            <span className="font-semibold text-right">{colaborador.nome}</span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">E-mail</span>
            <span className="font-medium text-right truncate">{colaborador.email}</span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">CPF</span>
            <span className="font-mono text-right">{colaborador.cpf || 'Não informado'}</span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Telefone</span>
            <span className="font-mono text-right">{colaborador.telefone || 'Não informado'}</span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Endereço</span>
            <span className="text-right max-w-[210px] break-words">
              {colaborador.endereco || 'Não informado'}
            </span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Função</span>
            <span className="font-semibold text-right">{colaborador.funcao}</span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Lotação</span>
            <span className="font-semibold text-right">{colaborador.lotacao}</span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Admissão</span>
            <span className="font-mono tabular-nums text-right">
              {formatDateBR(colaborador.dataAdmissao)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Salário Base</span>
            <span className="font-mono tabular-nums font-semibold text-right">
              {formatBRL(colaborador.salarioBase)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">VA / VT Diário</span>
            <span className="font-mono tabular-nums text-right">
              {formatBRL(colaborador.vaDiario)} · {formatBRL(colaborador.vtDiario)}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h2 className="text-sm font-bold">Avisos da Empresa</h2>
          </div>
          {isGestor && (
            <button
              type="button"
              onClick={() => setMostrarForm((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-[#DC2626] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo aviso</span>
            </button>
          )}
        </div>

        {mostrarForm && isGestor && (
          <form onSubmit={handlePublicar} className="mb-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título do comunicado"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            />
            <textarea
              rows={2}
              required
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Mensagem aos colaboradores..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold cursor-pointer"
            >
              Publicar Aviso
            </button>
          </form>
        )}

        {avisosVisiveis.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
            Nenhum aviso publicado no momento.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2">
            {avisosVisiveis.map((av) => (
              <div key={av.id} className="pt-2 first:pt-0 text-xs">
                <div className="font-bold">{av.titulo}</div>
                <p className="text-zinc-600 dark:text-zinc-300 mt-0.5">{av.mensagem}</p>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {av.autorNome} · {formatDateBR(av.criadoEm.slice(0, 10))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
