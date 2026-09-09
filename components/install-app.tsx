'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const INSTALL_REQUEST_EVENT = 'progressed-pedago:install-request';
const INSTALL_STATE_KEY = 'progressed-pedago:installed';

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

function isStandaloneApp() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function wasInstalledOnThisDevice() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(INSTALL_STATE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberInstallation() {
  try {
    window.localStorage.setItem(INSTALL_STATE_KEY, '1');
  } catch {
    // Certains navigateurs privés refusent le stockage local ; l’installation reste utilisable.
  }
}

function requestInstallation() {
  window.dispatchEvent(new Event(INSTALL_REQUEST_EVENT));
}

export function InstallAppButton() {
  return <button className="nav-item install-app-trigger" type="button" onClick={requestInstallation} aria-haspopup="dialog">
    <span className="nav-icon" aria-hidden="true">⇩</span>
    <span className="install-app-default-label">Installer l’application</span>
    <span className="install-app-installed-label">Application déjà installée</span>
  </button>;
}

export function LearnerInstallButton() {
  return <button className="learner-install-trigger" type="button" onClick={requestInstallation} aria-haspopup="dialog">
    <span aria-hidden="true">⇩</span>
    <span className="install-app-default-label">Installer l’application</span>
    <span className="install-app-installed-label">Application déjà installée</span>
  </button>;
}

export function LearnerInstallCard({ sharedAccess = false }: { sharedAccess?: boolean }) {
  return <>
    <section className="learner-install-card" aria-label="Accès rapide à Progressed Pédago">
      <Image src="/icons/progressed-pedago-192.png" width={58} height={58} alt="" />
      <div>
        <strong>Retrouvez Progressed Pédago en un geste</strong>
        <p>{sharedAccess ? 'Ajoutez l’icône à votre écran d’accueil pour retrouver facilement ce parcours.' : 'Ajoutez l’icône à votre téléphone ou à votre ordinateur pour revenir directement à votre espace apprenant.'}</p>
      </div>
      <LearnerInstallButton />
    </section>
    <InstallApp />
  </>;
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneApp() || wasInstalledOnThisDevice());
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isStandaloneApp()) rememberInstallation();
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setInstalled(false);
      setAlreadyInstalled(false);
    };
    const appInstalled = () => {
      rememberInstallation();
      setInstalled(true);
      setAlreadyInstalled(true);
      setPromptEvent(null);
      setFeedback('Progressed Pédago est maintenant installé sur cet appareil. Vous pouvez fermer ce message et ouvrir l’application depuis son icône.');
      setShowGuide(true);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', appInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showGuide) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showGuide]);

  useEffect(() => {
    const requestInstall = () => {
      void (async () => {
        if (isStandaloneApp() || installed) {
          setAlreadyInstalled(true);
          setFeedback('Progressed Pédago est déjà installé sur cet appareil. Vous utilisez actuellement la version installée.');
          setShowGuide(true);
          return;
        }
        setAlreadyInstalled(false);
        if (!promptEvent) {
          setFeedback('');
          setShowGuide(true);
          return;
        }
        try {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === 'accepted') {
            rememberInstallation();
            setInstalled(true);
            setAlreadyInstalled(true);
            setFeedback('Progressed Pédago est maintenant installé. Son icône est disponible depuis les applications de votre appareil.');
          } else {
            setFeedback('Installation annulée. Vous pouvez recommencer ou suivre les étapes ci-dessous.');
          }
          setShowGuide(true);
          setPromptEvent(null);
        } catch {
          setFeedback('Ce navigateur ne permet pas l’installation automatique. Suivez les étapes ci-dessous.');
          setShowGuide(true);
        }
      })();
    };
    window.addEventListener(INSTALL_REQUEST_EVENT, requestInstall);
    return () => window.removeEventListener(INSTALL_REQUEST_EVENT, requestInstall);
  }, [installed, promptEvent]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setFeedback('Adresse copiée. Collez-la dans Safari, Chrome ou Microsoft Edge.');
    } catch {
      setFeedback(`Adresse à ouvrir : ${window.location.origin}`);
    }
  };

  if (!showGuide) return null;

  const guide = installationGuide();

  return <div className="install-app-layer">
    <section className="install-app-dialog" role="dialog" aria-modal="false" aria-labelledby="install-app-title">
      <button className="install-app-close" type="button" onClick={() => setShowGuide(false)} aria-label="Fermer">×</button>
      <Image src="/icons/progressed-pedago-192.png" width={88} height={88} alt="Icône Progressed Pédago" priority />
      <p className="overline">Accès rapide</p>
      <h2 id="install-app-title">{alreadyInstalled ? 'Progressed Pédago est déjà installé' : 'Ajouter Progressed Pédago à l’écran d’accueil'}</h2>
      {alreadyInstalled ? <div className="install-app-success"><span aria-hidden="true">✓</span><div><strong>Application disponible</strong><p>{feedback}</p></div></div> : <>
        <div className="install-app-device"><strong>{guide.label}</strong><span>{promptEvent ? 'Installation directe disponible' : 'Installation guidée'}</span></div>
        <ol className="install-app-steps">{guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
        {feedback && <p className="install-app-feedback" role="status">{feedback}</p>}
        <p className="install-app-note">L’application ouvrira directement le site dans une fenêtre dédiée. Vos identifiants restent protégés et aucune donnée de cours n’est stockée hors connexion.</p>
        <div className="install-app-actions">
          <a className="button light" href="/" target="_blank" rel="noreferrer">Ouvrir dans un nouvel onglet</a>
          <button className="button light" type="button" onClick={() => void copyAddress()}>Copier l’adresse</button>
        </div>
      </>}
      <button className="button dark full" type="button" onClick={() => setShowGuide(false)}>{alreadyInstalled ? 'Continuer dans l’application' : 'Fermer le guide'}</button>
    </section>
  </div>;
}
