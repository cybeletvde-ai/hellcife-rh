import React from 'react';
interface SplashScreenProps {
  fadingOut?: boolean;
}

const SPLASH_IMAGE_SRC = '/assets/aistudio/Emblema_Diab_lico_Vermelho_Hellcife_RH__0c9c5485.png';

export const SplashScreen: React.FC<SplashScreenProps> = ({ fadingOut = false }) => {
  return (
    <div
      className={`fixed inset-0 z-[100] w-full h-full bg-[#09090B] overflow-hidden select-none transition-opacity duration-500 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="HELLCIFE RH+"
    >
      <img
        src={SPLASH_IMAGE_SRC}
        alt="HELLCIFE RH+"
        className="w-full h-full object-cover object-center block"
      />
    </div>
  );
};
