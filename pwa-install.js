/* PWA de La Movida SST+. No altera pestañas, catálogo, formularios ni destinos externos. */
(() => {
  'use strict';
  const entry = document.getElementById('pwaInstallEntry');
  const action = document.getElementById('pwaInstallButton');
  const dismiss = document.getElementById('pwaInstallDismiss');
  const guide = document.getElementById('pwaInstallHelp');
  const menuButton = document.getElementById('pwaInstallMenu');
  if (!entry || !action || !dismiss || !guide) return;

  const mobile = window.matchMedia('(max-width:760px)');
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inAppBrowser = /Instagram|FBAN|FBAV|Line\/|wv\)/i.test(navigator.userAgent);
  const key = 'movidasst.pwa.install.dismissedUntil';
  let deferredPrompt = null;
  let dismissed = false;
  try { dismissed = Number(localStorage.getItem(key) || 0) > Date.now(); } catch {}

  function render() {
    const alreadyInstalled = standalone();
    entry.hidden = alreadyInstalled || !mobile.matches || dismissed;
    if (menuButton) menuButton.hidden = alreadyInstalled || !mobile.matches;
    action.textContent = ios ? 'Cómo instalar' : 'Instalar';
  }
  function showGuide() {
    const instruction = ios
      ? 'En Safari, toca Compartir → Añadir a pantalla de inicio, activa “Abrir como app” y pulsa Añadir.'
      : 'En Chrome, abre el menú ⋮ y selecciona “Instalar aplicación” o “Añadir a pantalla principal”.';
    guide.textContent = inAppBrowser
      ? 'Si abriste el enlace desde otra aplicación, ábrelo primero en Safari (iPhone) o Chrome (Android). ' + instruction
      : instruction;
    guide.hidden = false;
    dismissed = false;
    render();
  }
  async function install() {
    if (standalone()) return;
    if (!deferredPrompt) { showGuide(); return; }
    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        guide.hidden = false;
        guide.textContent = 'Instalación solicitada. Sigue los pasos del navegador.';
      } else {
        guide.hidden = false;
        guide.textContent = 'Puedes instalarla más adelante desde el menú de Chrome.';
      }
    } catch {
      showGuide();
    }
  }

  action.addEventListener('click', install);
  dismiss.addEventListener('click', () => {
    dismissed = true;
    guide.hidden = true;
    try { localStorage.setItem(key, String(Date.now() + 30 * 86400000)); } catch {}
    render();
  });
  menuButton?.addEventListener('click', () => {
    dismissed = false;
    guide.hidden = true;
    const mobileMenu = document.getElementById('mobileMenu');
    const trigger = document.getElementById('menuTrigger');
    if (mobileMenu) mobileMenu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
    const homeTab = document.querySelector('.bottom-nav [data-hub-tab="inicio"]');
    if (homeTab) homeTab.click();
    render();
    if (deferredPrompt) install();
    else {
      showGuide();
      entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    render();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    dismissed = true;
    guide.hidden = true;
    render();
  });
  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', render);
  else if (typeof mobile.addListener === 'function') mobile.addListener(render);
  render();

  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(error => {
      console.warn('La instalación sin conexión todavía no está disponible:', error);
    });
  }
})();
