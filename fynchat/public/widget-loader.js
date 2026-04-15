(function () {
  // 1. Try global variable (Preferred)
  // 2. Try currentScript attributes (Legacy)
  const config = window.FYNCHAT_CONFIG || {};
  const script =
    document.currentScript ||
    Array.from(document.getElementsByTagName('script')).find(s => s.src.includes('widget-loader.js')) ||
    Array.from(document.getElementsByTagName('script')).find(s => s.hasAttribute('data-api-key'));

  const API_KEY = config.apiKey || (script ? script.getAttribute('data-api-key') : null);
  const loaderScript = document.currentScript ||
    Array.from(document.getElementsByTagName('script')).find(s => s.src.includes('widget-loader.js'));
  const WIDGET_URL = loaderScript ? new URL(loaderScript.src).origin : 'http://localhost:3000';

  if (API_KEY) {
    localStorage.setItem('fynchat_api_key', API_KEY);
  }

  console.log('Widget Loader: config found =', !!window.FYNCHAT_CONFIG);
  console.log('Widget Loader: API_KEY =', API_KEY);

  if (!API_KEY) {
    console.error('Chat widget: API key missing from window.FYNCHAT_CONFIG or script attributes');
    return;
  }

  // ---------- BUTTON ----------
  const button = document.createElement('div');
  button.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  button.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: 0 8px 24px -4px rgba(37, 99, 235, 0.4);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: center;
    `;

  button.onmouseenter = () => {
    button.style.transform = 'scale(1.1) translateY(-4px)';
    button.style.boxShadow = '0 15px 35px -5px rgba(37, 99, 235, 0.5)';
  };
  button.onmouseleave = () => {
    button.style.transform = 'scale(1) translateY(0)';
    button.style.boxShadow = '0 10px 30px -5px rgba(37, 99, 235, 0.4)';
  };

  // ---------- IFRAME ----------
  const iframe = document.createElement('iframe');
  iframe.src = `${WIDGET_URL}/?apiKey=${API_KEY}`;
  iframe.name = API_KEY;
  iframe.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 380px;
      height: 480px;
      border: none;
      border-radius: 24px;
      display: none;
      z-index: 2147483647;
      background: transparent;
      box-shadow: none;
      color-scheme: light;
    `;

  let open = false;

  button.onclick = () => {
    open = !open;
    iframe.style.display = open ? 'block' : 'none';
  };

  window.addEventListener('message', (event) => {
    if (event.data === 'closeFynChat') {
      open = false;
      iframe.style.display = 'none';
    }
  });

  document.body.appendChild(button);
  document.body.appendChild(iframe);
})();
