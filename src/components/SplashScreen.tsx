import React from 'react';
interface SplashScreenProps {
  fadingOut?: boolean;
}

const SPLASH_LOGO_SRC = '/assets/aistudio/hellcife_icone_app_1024_6c9db6fe.png';

export const SplashScreen: React.FC<SplashScreenProps> = ({ fadingOut = false }) => {
  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#09090B] flex flex-col items-center justify-center px-6 select-none transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="HELLCIFE RH+"
    >
      <div className="flex flex-col items-center justify-center">
        <div className="rounded-2xl overflow-hidden bg-[#09090B] shadow-[0_0_48px_rgba(220,38,38,0.18)] ring-1 ring-white/5 flex items-center justify-center">
          <img
            src={SPLASH_LOGO_SRC}
            alt="Hellcife Tattoo Supply"
            className="w-56 sm:w-64 max-w-[72vw] aspect-square object-cover rounded-2xl block"
          />
        </div>
        <div className="mt-5 text-2xl font-extrabold uppercase tracking-widest leading-none text-center text-[#FFFFFF]">
          HELLCIFE RH+
        </div>
      </div>
    </div>
  );
};
