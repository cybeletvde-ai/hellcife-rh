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
      aria-label="HELLCIFE RH+"
    >
      <div className="flex flex-col items-center justify-center">
        <div className="rounded-2xl overflow-hidden bg-[#09090B] flex items-center justify-center">
          <img
            src={LOGO_EMPRESA_SRC}
            alt="Hellcife Tattoo Supply"
            className="w-56 max-w-[70vw] max-h-56 object-contain rounded-2xl mix-blend-lighten"
          />
        </div>
        <div className="mt-4 text-2xl font-extrabold uppercase tracking-[0.18em] leading-none text-center text-white">
          HELLCIFE RH+
        </div>
      </div>
    </div>
  );
};
