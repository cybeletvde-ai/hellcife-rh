-- ============================================================================
-- HellcifeRH+ (Hellcife Tattoo Supply) - Script SQL Completo para Supabase
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================================

-- 1. Jornadas de Trabalho
CREATE TABLE IF NOT EXISTS public.jornadas_template (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  horas_semanais INTEGER NOT NULL DEFAULT 44,
  seg_sex_entrada TEXT NOT NULL DEFAULT '09:00',
  seg_sex_saida TEXT NOT NULL DEFAULT '18:00',
  seg_sex_carga_min INTEGER NOT NULL DEFAULT 480,
  intervalo_min INTEGER NOT NULL DEFAULT 60,
  sabado_ativo BOOLEAN NOT NULL DEFAULT true,
  sabado_entrada TEXT NOT NULL DEFAULT '09:00',
  sabado_saida TEXT NOT NULL DEFAULT '13:00',
  sabado_carga_min INTEGER NOT NULL DEFAULT 240
);

-- 2. Colaboradores
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  funcao TEXT NOT NULL,
  lotacao TEXT NOT NULL CHECK (lotacao IN ('Recife', 'Jaboatão', 'Ambas')),
  data_admissao TEXT NOT NULL,
  salario_base NUMERIC(12, 2) NOT NULL DEFAULT 1621.00,
  va_diario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  vt_diario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  jornada_id TEXT NOT NULL DEFAULT 'jornada-44h',
  grade_semanal JSONB,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS telefone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS endereco TEXT NOT NULL DEFAULT '';
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS grade_semanal JSONB;

CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON public.colaboradores (LOWER(email));

-- 3. Empresas / Unidades (Unidade Recife e Unidade Jaboatão)
CREATE TABLE IF NOT EXISTS public.empresas_unidades (
  unidade TEXT PRIMARY KEY CHECK (unidade IN ('Recife', 'Jaboatão')),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT NOT NULL DEFAULT '',
  cep TEXT NOT NULL DEFAULT '',
  logradouro TEXT NOT NULL DEFAULT '',
  numero TEXT NOT NULL DEFAULT '',
  complemento TEXT NOT NULL DEFAULT '',
  bairro TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  uf TEXT NOT NULL DEFAULT 'PE',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Localização GPS das Unidades
CREATE TABLE IF NOT EXISTS public.localizacoes_gps (
  unidade TEXT PRIMARY KEY CHECK (unidade IN ('Recife', 'Jaboatão')),
  nome_loja TEXT NOT NULL,
  endereco TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  raio_metros INTEGER NOT NULL DEFAULT 250,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Configurações Gerais da Empresa e Regras Sindicais
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id TEXT PRIMARY KEY DEFAULT 'default',
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  regime_tributario TEXT NOT NULL DEFAULT 'Simples Nacional',
  banco_horas_modo TEXT NOT NULL DEFAULT 'Pagamento Mensal (Sem Acúmulo)',
  regras_unidade JSONB NOT NULL,
  notificacoes JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Registos de Ponto (Portaria MTP nº 671/2021 + Blindagem Antifraude)
CREATE TABLE IF NOT EXISTS public.registros_ponto (
  id TEXT PRIMARY KEY,
  nsr BIGINT NOT NULL,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  unidade TEXT NOT NULL CHECK (unidade IN ('Recife', 'Jaboatão')),
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  criado_em_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distancia_metros INTEGER,
  localizacao_verificada BOOLEAN NOT NULL DEFAULT false,
  selfie_data_url TEXT,
  registrado_por TEXT,
  justificativa_deslocamento TEXT,
  origem_registro TEXT NOT NULL DEFAULT 'colaborador_gps' CHECK (origem_registro IN ('colaborador_gps', 'manual_gestor')),
  hash_comprovante TEXT NOT NULL
);

ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS criado_em_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS selfie_data_url TEXT;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS registrado_por TEXT;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS justificativa_deslocamento TEXT;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS origem_registro TEXT NOT NULL DEFAULT 'colaborador_gps';

CREATE INDEX IF NOT EXISTS idx_registros_ponto_colab_data ON public.registros_ponto (colaborador_id, data);

-- Função RPC para leitura direta da hora oficial do servidor (America/Recife)
CREATE OR REPLACE FUNCTION public.agora_recife()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'iso', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'data', to_char(NOW() AT TIME ZONE 'America/Recife', 'YYYY-MM-DD'),
    'hora', to_char(NOW() AT TIME ZONE 'America/Recife', 'HH24:MI:SS'),
    'epoch_ms', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );
$$;

GRANT EXECUTE ON FUNCTION public.agora_recife() TO anon, authenticated;

-- Trigger que impede manipulação do relógio do dispositivo em batidas de colaboradores
CREATE OR REPLACE FUNCTION public.forcar_hora_servidor_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recife TIMESTAMP;
BEGIN
  NEW.criado_em_servidor := NOW();
  IF COALESCE(NEW.origem_registro, 'colaborador_gps') = 'colaborador_gps' AND NEW.registrado_por IS NULL THEN
    v_recife := NEW.criado_em_servidor AT TIME ZONE 'America/Recife';
    NEW.data := to_char(v_recife, 'YYYY-MM-DD');
    NEW.hora := to_char(v_recife, 'HH24:MI:SS');
    NEW.timestamp := to_char(NEW.criado_em_servidor AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forcar_hora_servidor_ponto ON public.registros_ponto;
CREATE TRIGGER trg_forcar_hora_servidor_ponto
  BEFORE INSERT ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.forcar_hora_servidor_ponto();

-- 7. Atestados e Justificativas
CREATE TABLE IF NOT EXISTS public.atestados (
  id TEXT PRIMARY KEY,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Atestado Médico', 'Justificativa de Atraso')),
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  minutos_abonados INTEGER,
  motivo TEXT NOT NULL,
  anexo_nome TEXT,
  anexo_data_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Recusado')),
  observacao_rh TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atestados_colab ON public.atestados (colaborador_id);

-- 8. Ajustes de Escala e Horários Específicos
CREATE TABLE IF NOT EXISTS public.ajustes_escala (
  id TEXT PRIMARY KEY,
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('normal', 'folga', 'horario_proprio')),
  entrada_custom TEXT,
  saida_custom TEXT,
  carga_min_custom INTEGER,
  motivo TEXT NOT NULL DEFAULT '',
  UNIQUE (colaborador_id, data)
);

-- 9. Feriados Nacionais, Estaduais e Municipais
CREATE TABLE IF NOT EXISTS public.feriados (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  nome TEXT NOT NULL,
  abrangencia TEXT NOT NULL CHECK (abrangencia IN ('Nacional', 'Estadual', 'Recife', 'Jaboatão'))
);

-- 10. Fechamentos Mensais de Folha
CREATE TABLE IF NOT EXISTS public.fechamentos_mensais (
  id TEXT PRIMARY KEY,
  mes TEXT NOT NULL,
  unidade TEXT NOT NULL CHECK (unidade IN ('Todas', 'Recife', 'Jaboatão')),
  fechado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fechado_por TEXT NOT NULL
);

-- 11. Avisos e Comunicados Internos
CREATE TABLE IF NOT EXISTS public.avisos_empresa (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  unidade_alvo TEXT NOT NULL CHECK (unidade_alvo IN ('Todas', 'Recife', 'Jaboatão')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  autor_nome TEXT NOT NULL
);

-- ============================================================================
-- Permissões de Leitura e Escrita (Sem bloqueio de RLS para funcionamento imediato)
-- ============================================================================
ALTER TABLE public.jornadas_template DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas_unidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.localizacoes_gps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_sistema DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_ponto DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_escala DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamentos_mensais DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_empresa DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- Habilitar Sincronização em Tempo Real (Supabase Realtime)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
  tabelas TEXT[] := ARRAY[
    'jornadas_template',
    'colaboradores',
    'empresas_unidades',
    'localizacoes_gps',
    'configuracoes_sistema',
    'registros_ponto',
    'atestados',
    'ajustes_escala',
    'feriados',
    'fechamentos_mensais',
    'avisos_empresa'
  ];
BEGIN
  FOREACH tbl IN ARRAY tabelas LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
