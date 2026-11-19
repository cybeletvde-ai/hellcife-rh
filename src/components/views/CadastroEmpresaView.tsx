import React, { useState } from 'react';
import { CheckCircle2, Landmark, MapPin } from 'lucide-react';
import {
  ConfiguracaoEmpresa,
  DadosEmpresaUnidade,
  Unidade,
  getDadosEmpresaUnidade,
} from '../../types/rh';

interface CadastroEmpresaViewProps {
  config: ConfiguracaoEmpresa;
  onSalvarConfig: (cfg: ConfiguracaoEmpresa) => Promise<boolean>;
}

export const CadastroEmpresaView: React.FC<CadastroEmpresaViewProps> = ({
  config,
  onSalvarConfig,
}) => {
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<Unidade>('Recife');
  const [empresas, setEmpresas] = useState<Record<Unidade, DadosEmpresaUnidade>>(() => ({
    Recife: getDadosEmpresaUnidade(config, 'Recife'),
    Jaboatão: getDadosEmpresaUnidade(config, 'Jaboatão'),
  }));
  const [salvoMsg, setSalvoMsg] = useState('');

  const atual = empresas[unidadeSelecionada];

  const atualizarCampo = (campo: keyof DadosEmpresaUnidade, valor: string) => {
    setEmpresas((prev) => ({
      ...prev,
      [unidadeSelecionada]: {
        ...prev[unidadeSelecionada],
        [campo]: campo === 'uf' ? valor.toUpperCase().slice(0, 2) : valor,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const recifeLimpo: DadosEmpresaUnidade = {
      ...empresas.Recife,
      unidade: 'Recife',
      razaoSocial: empresas.Recife.razaoSocial.trim(),
      nomeFantasia: empresas.Recife.nomeFantasia.trim(),
      cnpj: empresas.Recife.cnpj.trim(),
      inscricaoEstadual: empresas.Recife.inscricaoEstadual.trim(),
      cep: empresas.Recife.cep.trim(),
      logradouro: empresas.Recife.logradouro.trim(),
      numero: empresas.Recife.numero.trim(),
      complemento: empresas.Recife.complemento.trim(),
      bairro: empresas.Recife.bairro.trim(),
      cidade: empresas.Recife.cidade.trim(),
      uf: empresas.Recife.uf.trim().toUpperCase(),
      telefone: empresas.Recife.telefone.trim(),
      email: empresas.Recife.email.trim(),
      site: empresas.Recife.site.trim(),
    };

    const jaboataoLimpo: DadosEmpresaUnidade = {
      ...empresas['Jaboatão'],
      unidade: 'Jaboatão',
      razaoSocial: empresas['Jaboatão'].razaoSocial.trim(),
      nomeFantasia: empresas['Jaboatão'].nomeFantasia.trim(),
      cnpj: empresas['Jaboatão'].cnpj.trim(),
      inscricaoEstadual: empresas['Jaboatão'].inscricaoEstadual.trim(),
      cep: empresas['Jaboatão'].cep.trim(),
      logradouro: empresas['Jaboatão'].logradouro.trim(),
      numero: empresas['Jaboatão'].numero.trim(),
      complemento: empresas['Jaboatão'].complemento.trim(),
      bairro: empresas['Jaboatão'].bairro.trim(),
      cidade: empresas['Jaboatão'].cidade.trim(),
      uf: empresas['Jaboatão'].uf.trim().toUpperCase(),
      telefone: empresas['Jaboatão'].telefone.trim(),
      email: empresas['Jaboatão'].email.trim(),
      site: empresas['Jaboatão'].site.trim(),
    };

    const atualizadas: Record<Unidade, DadosEmpresaUnidade> = {
      Recife: recifeLimpo,
      Jaboatão: jaboataoLimpo,
    };

    const ok = await onSalvarConfig({
      ...config,
      razaoSocial: recifeLimpo.razaoSocial || config.razaoSocial,
      nomeFantasia: recifeLimpo.nomeFantasia || config.nomeFantasia,
      cnpj: recifeLimpo.cnpj || config.cnpj,
      empresasUnidade: atualizadas,
    });

    if (ok) {
      setEmpresas(atualizadas);
      setSalvoMsg(`Dados da Unidade ${unidadeSelecionada} salvos com sucesso.`);
      setTimeout(() => setSalvoMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Formulário por Unidade */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Landmark className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Cadastro Empresa</h1>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
            Holerite & Portaria 671
          </span>
        </div>

        {/* Seletor de Unidade no Topo */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900">
          {(['Recife', 'Jaboatão'] as Unidade[]).map((u) => {
            const ativo = unidadeSelecionada === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUnidadeSelecionada(u);
                  setSalvoMsg('');
                }}
                className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  ativo
                    ? 'bg-[#DC2626] text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>Unidade {u}</span>
              </button>
            );
          })}
        </div>

        {salvoMsg && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{salvoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-2 text-xs">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
              Razão Social
            </label>
            <input
              type="text"
              required
              value={atual.razaoSocial}
              onChange={(e) => atualizarCampo('razaoSocial', e.target.value)}
              placeholder="Razão Social da unidade"
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
              Nome Fantasia
            </label>
            <input
              type="text"
              required
              value={atual.nomeFantasia}
              onChange={(e) => atualizarCampo('nomeFantasia', e.target.value)}
              placeholder="ex.: Hellcife Tattoo Supply"
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">CNPJ</label>
              <input
                type="text"
                required
                value={atual.cnpj}
                onChange={(e) => atualizarCampo('cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                Inscrição Estadual
              </label>
              <input
                type="text"
                value={atual.inscricaoEstadual}
                onChange={(e) => atualizarCampo('inscricaoEstadual', e.target.value)}
                placeholder="Isento ou nº IE"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-2">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">CEP</label>
              <input
                type="text"
                value={atual.cep}
                onChange={(e) => atualizarCampo('cep', e.target.value)}
                placeholder="50000-000"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Bairro</label>
              <input
                type="text"
                value={atual.bairro}
                onChange={(e) => atualizarCampo('bairro', e.target.value)}
                placeholder="Bairro"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
              Rua / Logradouro
            </label>
            <input
              type="text"
              value={atual.logradouro}
              onChange={(e) => atualizarCampo('logradouro', e.target.value)}
              placeholder="Av. / Rua"
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-[88px_1fr] gap-2">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                Número (Nº)
              </label>
              <input
                type="text"
                value={atual.numero}
                onChange={(e) => atualizarCampo('numero', e.target.value)}
                placeholder="Nº"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                Complemento
              </label>
              <input
                type="text"
                value={atual.complemento}
                onChange={(e) => atualizarCampo('complemento', e.target.value)}
                placeholder="Sala, Loja, Galeria..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_64px] gap-2">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Cidade</label>
              <input
                type="text"
                value={atual.cidade}
                onChange={(e) => atualizarCampo('cidade', e.target.value)}
                placeholder="Cidade"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">UF</label>
              <input
                type="text"
                maxLength={2}
                value={atual.uf}
                onChange={(e) => atualizarCampo('uf', e.target.value)}
                placeholder="PE"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-center uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                Telefone
              </label>
              <input
                type="tel"
                value={atual.telefone}
                onChange={(e) => atualizarCampo('telefone', e.target.value)}
                placeholder="(81) 99999-9999"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">E-mail</label>
              <input
                type="email"
                value={atual.email}
                onChange={(e) => atualizarCampo('email', e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Site</label>
            <input
              type="text"
              value={atual.site}
              onChange={(e) => atualizarCampo('site', e.target.value)}
              placeholder="https://www.hellcifetattoo.com.br"
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white font-bold cursor-pointer transition-colors"
          >
            SALVAR DADOS DA EMPRESA
          </button>
        </form>
      </section>

      {/* Lista Compacta das Duas Unidades */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Resumo das Unidades
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          {(['Recife', 'Jaboatão'] as Unidade[]).map((u) => {
            const emp = empresas[u];
            const selecionada = unidadeSelecionada === u;
            const enderecoCompacto = [
              emp.logradouro && `${emp.logradouro}${emp.numero ? `, ${emp.numero}` : ''}`,
              emp.bairro,
              emp.cidade && `${emp.cidade}${emp.uf ? `/${emp.uf}` : ''}`,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <div key={u} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#111827] dark:text-white">
                      Unidade {u}
                    </span>
                    {selecionada && (
                      <span className="text-[10px] font-semibold text-[#DC2626]">
                        · Em edição
                      </span>
                    )}
                  </div>
                  <div className="font-medium truncate">{emp.nomeFantasia || emp.razaoSocial}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                    CNPJ: {emp.cnpj || '—'}
                    {emp.inscricaoEstadual ? ` · IE: ${emp.inscricaoEstadual}` : ''}
                  </div>
                  {enderecoCompacto && (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {enderecoCompacto}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setUnidadeSelecionada(u)}
                  className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold hover:border-[#DC2626] hover:text-[#DC2626] cursor-pointer shrink-0"
                >
                  Editar
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
