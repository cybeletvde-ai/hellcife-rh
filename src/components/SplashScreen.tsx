import React from 'react';
import { LOGO_EMPRESA_SRC } from './BrandLogo';

interface SplashScreenProps {
  fadingOut?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ fadingOut = false }) => {
  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#09090B] flex flex-col items-center justify-center px-6 select-none transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="HellcifeRH+"
    >
      <div className="flex flex-col items-center justify-center">
        <img
          src={LOGO_EMPRESA_SRC}
          alt="Hellcife Tattoo Supply"
          className="w-28 h-32 object-contain mix-blend-lighten"
        />
        <div className="mt-3 text-2xl font-extrabold tracking-tight leading-none text-center">
          <span className="text-[#DC2626]">Hellcife</span>
          <span className="text-white">RH+</span>
        </div>
      </div>
    </div>
  );
};
