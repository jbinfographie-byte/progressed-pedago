'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallGuide = {
  label: string;
  steps: string[];
};

function installationGuide(): InstallGuide {
  if (typeof navigator === 'undefined') return { label: 'Votre appareil', steps: [] };
  const agent = navigator.userAgent;
  const isSafari = /Safari/.test(agent) && !/Chrome|Chromium|CriOS|Edg|OPR/.test(agent);
  const isIPadOS = /Macintosh/.test(agent) && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(agent) || isIPadOS) return {
    label: 'Sur iPhone ou iPad',
    steps: ['Ouvrez cette page dans Safari.', 'Touchez le bouton Partager.', 'Choisissez « Sur l’écran d’accueil », puis « Ajouter ».'],
  };
  if (/Android/.test(agent)) return {
    label: 'Sur Android',
    steps: ['Ouvrez cette page dans Chrome.', 'Touchez le menu ⋮.', 'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».'],
  };
  if (/Macintosh/.test(agent) && isSafari) return {
    label: 'Sur Mac avec Safari',
    steps: ['Ouvrez cette page dans Safari.', 'Dans le menu Fichier, choisissez « Ajouter au Dock ».', 'Validez le nom Progressed Pédago et cliquez sur « Ajouter ».'],
  };
  if (/Windows/.test(agent)) return {
    label: 'Sur un ordinateur Windows',
    steps: ['Ouvrez cette page dans Chrome ou Microsoft Edge.', 'Cliquez sur l’icône d’installation dans la barre d’adresse, ou ouvrez le menu ⋮.', 'Choisissez « Installer Progressed Pédago » et, si proposé, créez le raccourci sur le Bureau.'],
  };
  return {
    label: 'Sur votre ordinateur',
    steps: ['Ouvrez cette page dans Chrome, Edge ou Safari.', 'Ouvrez le menu du navigateur.', 'Choisissez « Installer Progressed Pédago », « Créer un raccourci » ou « Ajouter au Dock ».'],
  };
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
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
      setFeedback('');
      setShowGuide(true);
      return;
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setShowGuide(false);
      } else {
        setFeedback('Installation annulée. Vous pouvez recommencer ou suivre les étapes ci-dessous.');
        setShowGuide(true);
      }
      setPromptEvent(null);
    } catch {
      setFeedback('Ce navigateur ne permet pas l’installation automatique. Suivez les étapes ci-dessous.');
      setShowGuide(true);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setFeedback('Adresse copiée. Collez-la dans Safari, Chrome ou Microsoft Edge.');
    } catch {
      setFeedback(`Adresse à ouvrir : ${window.location.origin}`);
    }
  };

  const guide = installationGuide();

  return <>
    <button className="nav-item install-app-trigger" type="button" onClick={() => void install()} aria-haspopup="dialog">
      <span className="nav-icon" aria-hidden="true">⇩</span>
      <span>Installer l’application</span>
    </button>
    {showGuide && <div className="install-app-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-app-title">
      <section className="install-app-dialog">
        <button className="install-app-close" type="button" onClick={() => setShowGuide(false)} aria-label="Fermer">×</button>
        <Image src="/icons/progressed-pedago-192.png" width={88} height={88} alt="Icône Progressed Pédago" priority />
        <p className="overline">Accès rapide</p>
        <h2 id="install-app-title">Ajouter Progressed Pédago à l’écran d’accueil</h2>
        <div className="install-app-device"><strong>{guide.label}</strong><span>{promptEvent ? 'Installation directe disponible' : 'Installation guidée'}</span></div>
        <ol className="install-app-steps">{guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
        {feedback && <p className="install-app-feedback" role="status">{feedback}</p>}
        <p className="install-app-note">L’application ouvrira directement le site dans une fenêtre dédiée. Vos identifiants restent protégés et aucune donnée de cours n’est stockée hors connexion.</p>
        <div className="install-app-actions">
          {promptEvent && <button className="button dark" type="button" onClick={() => void install()}>Installer maintenant</button>}
          <a className="button light" href="/" target="_blank" rel="noreferrer">Ouvrir dans un nouvel onglet</a>
          <button className="button light" type="button" onClick={() => void copyAddress()}>Copier l’adresse</button>
        </div>
        <button className="install-app-dismiss" type="button" onClick={() => setShowGuide(false)}>Fermer le guide</button>
      </section>
    </div>}
  </>;
}
