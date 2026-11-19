import React from 'react';

export const BrandLogo: React.FC = () => {
  return (
    <div className="flex items-center justify-center gap-3">
      <img
        src="/assets/aistudio/Captura_de_tela_2026-11-19_010010_009c628b.png"
        alt="Logótipo Hellcife Tattoo Supply"
        className="h-[44px] w-auto object-contain shrink-0 mix-blend-lighten select-none"
      />
      <div className="flex flex-col justify-center text-left">
        <div className="text-lg font-extrabold leading-tight tracking-tight whitespace-nowrap">
          <span className="text-[#DC2626]">HELLCIFE</span>
          <span className="text-white">RH+</span>
        </div>
        <p className="text-xs font-medium leading-tight text-[#9CA3AF] whitespace-nowrap">
          Hellcife Tattoo Supply
        </p>
      </div>
    </div>
  );
};
