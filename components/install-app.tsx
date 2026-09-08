'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function installationGuide() {
  if (typeof navigator === 'undefined') return '';
  const agent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(agent)) return 'Dans Safari, touchez Partager, puis « Sur l’écran d’accueil » et enfin « Ajouter ».';
  if (/Android/.test(agent)) return 'Ouvrez le menu du navigateur, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
  if (/Macintosh/.test(agent) && /Safari/.test(agent) && !/Chrome/.test(agent)) return 'Dans Safari, ouvrez le menu Fichier puis choisissez « Ajouter au Dock ».';
  return 'Ouvrez le menu de votre navigateur, puis choisissez « Installer Progressed Pédago » ou « Ajouter à l’écran d’accueil ».';
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setInstalled(false);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowGuide(false);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', appInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!promptEvent) {
      setShowGuide(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  return <>
    <button className="install-app-trigger" type="button" onClick={() => void install()} aria-haspopup="dialog">
      <span aria-hidden="true">P</span>
      Installer l’application
    </button>
    {showGuide && <div className="install-app-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-app-title">
      <section className="install-app-dialog">
        <button className="install-app-close" type="button" onClick={() => setShowGuide(false)} aria-label="Fermer">×</button>
        <Image src="/icons/progressed-pedago-192.png" width={88} height={88} alt="Icône Progressed Pédago" priority />
        <p className="overline">Accès rapide</p>
        <h2 id="install-app-title">Ajouter Progressed Pédago à l’écran d’accueil</h2>
        <p>{installationGuide()}</p>
        <p className="install-app-note">L’application ouvrira directement le site dans une fenêtre dédiée. Vos identifiants restent protégés et aucune donnée de cours n’est stockée hors connexion.</p>
        <button className="button dark full" type="button" onClick={() => setShowGuide(false)}>J’ai compris</button>
      </section>
    </div>}
  </>;
}
