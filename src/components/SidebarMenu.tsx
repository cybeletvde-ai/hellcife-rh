import React from 'react';
import {
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Info,
  Landmark,
  LogOut,
  MapPin,
  Moon,
  Paperclip,
  PieChart,
  Receipt,
  Sun,
  Timer,
  UserCog,
  Wallet,
  X,
} from 'lucide-react';
import { Colaborador, MenuRoute, temPermissaoGestao } from '../types/rh';
import { PWAInstallButton } from './PWAInstallButton';
import { BrandLogo } from './BrandLogo';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: MenuRoute;
  onNavigate: (route: MenuRoute) => void;
  colaborador: Colaborador;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

interface MenuItem {
  id: MenuRoute;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const SEC_COLABORADOR: MenuItem[] = [
  { id: 'ponto', label: 'Ponto', icon: Fingerprint },
  { id: 'espelho', label: 'Espelho de Ponto', icon: Clock },
  { id: 'jornadas', label: 'Jornadas', icon: Timer },
  { id: 'escalas', label: 'Escalas', icon: CalendarDays },
  { id: 'horas-extras', label: 'Horas Extras', icon: FileSpreadsheet },
  { id: 'banco-horas', label: 'Banco de Horas', icon: Wallet },
  { id: 'holerite', label: 'Holerite', icon: Receipt },
  { id: 'atestados', label: 'Atestados', icon: Paperclip },
  { id: 'informacoes', label: 'Informações', icon: Info },
];

const SEC_RH: MenuItem[] = [
  { id: 'rh-fechamento', label: 'Fechamento', icon: CheckSquare },
  { id: 'rh-relatorio', label: 'Relatório', icon: FileText },
  { id: 'rh-retribuicao', label: 'Retribuição', icon: PieChart },
];

const SEC_SISTEMA: MenuItem[] = [
  { id: 'sys-colaboradores', label: 'Cadastro do Colaborador', icon: UserCog },
  { id: 'sys-empresa', label: 'Cadastro Empresa', icon: Landmark },
  { id: 'sys-configuracoes', label: 'Configurações', icon: Building2 },
  { id: 'sys-localizacao', label: 'Localização', icon: MapPin },
  { id: 'sys-importar', label: 'Importar dados & Notificações', icon: Bell },
];

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  isOpen,
  onClose,
  activeRoute,
  onNavigate,
  colaborador,
  darkMode,
  onToggleDarkMode,
  onLogout,
}) => {
  if (!isOpen) return null;

  const isGestor = temPermissaoGestao(colaborador.funcao);

  const renderSection = (titulo: string, items: MenuItem[]) => (
    <div className="mb-4">
      <div className="px-3 mb-1.5 text-[11px] font-bold tracking-wider text-zinc-400">
        {titulo}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                active
                  ? 'bg-[#DC2626] text-white'
                  : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="relative z-10 w-[290px] max-w-[85vw] bg-[#09090B] text-zinc-100 h-full flex flex-col border-r border-zinc-800 shadow-2xl">
        {/* Drawer Header */}
        <div className="p-3 border-b border-zinc-800 bg-[#09090B]">
          <div className="grid grid-cols-[28px_1fr_28px] items-center">
            <div aria-hidden="true" />
            <BrandLogo />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer flex items-center justify-center justify-self-end"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{colaborador.nome}</div>
            <div className="text-[11px] text-zinc-400 truncate">{colaborador.funcao}</div>
          </div>
        </div>

        {/* Scrollable Sections */}
        <nav className="flex-1 overflow-y-auto p-2.5">
          {renderSection('COLABORADOR', SEC_COLABORADOR)}
          {isGestor && renderSection('RH', SEC_RH)}
          {isGestor && renderSection('SISTEMA', SEC_SISTEMA)}
        </nav>

        {/* Footer: PWA + Dark Mode + Logout */}
        <div className="p-3 border-t border-zinc-800 space-y-2">
          <PWAInstallButton />

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-400" />}
              <span>Modo escuro</span>
            </span>
            <span className="text-[11px] text-zinc-400">{darkMode ? 'Ativo' : 'Padrão'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-red-950/50 hover:border-red-900 text-xs font-semibold text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
