const iframeStorageBridge = (nonce: string) => /* js */ `
(function() {
  const memoryStore = {};

  const NONCE = ${JSON.stringify(nonce)}
  
  const mockStorage = {
    getItem: function(key) {
      return memoryStore[key] !== undefined ? memoryStore[key] : null;
    },
    setItem: function(key, value) {
      memoryStore[key] = String(value);
      window.parent.postMessage({
        type: 'storage-set',
        key: key,
        value: String(value),
        nonce: NONCE
      }, '*');
    },
    removeItem: function(key) {
      delete memoryStore[key];
      window.parent.postMessage({
        type: 'storage-remove',
        key: key,
        nonce: NONCE
      }, '*');
    },
    clear: function() {
      for (const key in memoryStore) {
        delete memoryStore[key];
      }
      window.parent.postMessage({
        type: 'storage-clear',
        nonce: NONCE
      }, '*');
    },
    key: function(index) {
      const keys = Object.keys(memoryStore);
      return keys[index] !== undefined ? keys[index] : null;
    },
    get length() {
      return Object.keys(memoryStore).length;
    }
  };
  
  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: false,
      configurable: true
    });
  } catch (e) {
    window.localStorage = mockStorage;
  }
  
  window.addEventListener('message', function(event) {
    if (event.data.type === 'storage-sync-data' && event.data.nonce === NONCE) {
      const data = event.data.data;
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          memoryStore[key] = data[key];
        }
      }
      if (typeof window.initTheme === 'function') {
        window.initTheme();
      }
      window.dispatchEvent(new Event('storage-ready'));
    }
  });
  
  window.parent.postMessage({ 
    type: 'storage-sync-request',
    nonce: NONCE
  }, '*');
})();
`

const parentStorageBridge = (nonce: string) => /* js */ `
(function() {
  const host = document.querySelector('nuxt-error-overlay');
  if (!host) return;
  
  // Wait for shadow root to be attached
  const checkShadow = setInterval(function() {
    if (host.shadowRoot) {
      clearInterval(checkShadow);
      const iframe = host.shadowRoot.getElementById('pretty-errors');
      if (!iframe) return;

      const NONCE = ${JSON.stringify(nonce)}
      
      window.addEventListener('message', function(event) {
        if (!event.data || event.data.nonce !== NONCE) return;
        
        const data = event.data;
        
        if (data.type === 'storage-set') {
          localStorage.setItem(data.key, data.value);
        } else if (data.type === 'storage-remove') {
          localStorage.removeItem(data.key);
        } else if (data.type === 'storage-clear') {
          localStorage.clear();
        } else if (data.type === 'storage-sync-request') {
          const allData = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            allData[key] = localStorage.getItem(key);
          }
          iframe.contentWindow.postMessage({
            type: 'storage-sync-data',
            data: allData,
            nonce: NONCE
          }, '*');
        }
      });
    }
  }, 10);
})();
`

const errorCSS = /* css */ `
:host {
  all: initial;
  display: contents;
}
#pretty-errors-toggle .sr-only,
div[role="status"] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
#pretty-errors {
  width: 100%;
  height: 100%;
  border: none;
  pointer-events: auto;
}
#pretty-errors:not([inert]) {
  z-index: -1;
}
#pretty-errors-toggle {
  background: none;
  border: 15px #ffcdce solid;
  overflow: hidden;
  border-radius: 30px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
  pointer-events: auto;
  z-index: 999999999;
}
#pretty-errors-toggle:hover,
#pretty-errors-toggle:focus {
  opacity: 1;
  outline: 2px solid #ff6b6b;
  outline-offset: 2px;
}
#pretty-errors-toggle:focus-visible {
  outline: 3px solid #ff6b6b;
  outline-offset: 3px;
}
#pretty-errors, #pretty-errors-toggle {
  position: fixed;
  right: 0;
  bottom: 0;
}
#pretty-errors:not([inert]) {
  transform: scale(5) translateX(-80%);
  transform-origin: bottom left;
}
#pretty-errors:not([inert]) ~ #pretty-errors-toggle {
  left: 0;
  top: 0;
}
#pretty-errors[inert] {
  overflow: hidden;
  border-radius: 30px;
  transform: scale(0.2);
  transform-origin: bottom right;
  padding: 0;
}
#pretty-errors[inert] ~ #pretty-errors-toggle {
  transform: scale(0.2);
  transform-origin: bottom right;
  padding: 0;
  width: 100%;
  height: 100%;
  z-index: 1000000000;
}
@media (prefers-reduced-motion: reduce) {
  #pretty-errors-toggle {
    transition: none;
  }
}
`

function webComponentScript (base64HTML: string) {
  return /* js */ `
  (function() {
    try {
      const host = document.querySelector('nuxt-error-overlay');
      if (!host) return;
      
      const shadow = host.attachShadow({ mode: 'open' });
      
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(errorCSS)};
      
      const iframe = document.createElement('iframe');
      iframe.id = 'pretty-errors';
      iframe.src = 'data:text/html;base64,${base64HTML}';
      iframe.title = 'Detailed error stack trace';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      
      const button = document.createElement('button');
      button.id = 'pretty-errors-toggle';
      button.setAttribute('aria-label', 'Toggle detailed error view');
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('type', 'button');
      button.innerHTML = '<span aria-hidden="true">⚠</span><span class="sr-only">Toggle Error Details</span>';
      
      // Create a live region for screen reader announcements
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      
      // Store original body styles to restore them later
      const originalBodyStyles = {
        position: document.body.style.position,
        transform: document.body.style.transform,
        transformOrigin: document.body.style.transformOrigin,
        right: document.body.style.right,
        bottom: document.body.style.bottom,
        width: document.body.style.width,
        height: document.body.style.height,
        overflow: document.body.style.overflow
      };
      
      const SCALE_DOWN = 0.2;
      const SCALE_UP = 1 / SCALE_DOWN;
      const BODY_WIDTH = 1200; // Fixed width for minimized body
      const BODY_HEIGHT = 900; // Fixed height for minimized body
      
      function scaleBodyContent(shouldScale) {
        if (shouldScale) {
          // Set fixed dimensions before scaling down
          document.body.style.position = 'fixed';
          document.body.style.width = BODY_WIDTH + 'px';
          document.body.style.height = BODY_HEIGHT + 'px';
          document.body.style.transform = 'scale(' + SCALE_DOWN + ')';
          document.body.style.transformOrigin = 'bottom right';
          document.body.style.right = '0';
          document.body.style.bottom = '0';
          document.body.style.overflow = 'hidden';
          
          // Make iframe fill viewport when maximized
          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          
          // Counter-scale the overlay to keep it at normal size
          host.style.transform = 'scale(' + SCALE_UP + ')';
          host.style.transformOrigin = 'bottom right';
        } else {
          // Restore original body styles
          document.body.style.position = originalBodyStyles.position;
          document.body.style.transform = originalBodyStyles.transform;
          document.body.style.transformOrigin = originalBodyStyles.transformOrigin;
          document.body.style.right = originalBodyStyles.right;
          document.body.style.bottom = originalBodyStyles.bottom;
          document.body.style.width = originalBodyStyles.width;
          document.body.style.height = originalBodyStyles.height;
          document.body.style.overflow = originalBodyStyles.overflow;
          
          // Reset iframe to default size
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          
          // Reset overlay
          host.style.transform = '';
          host.style.transformOrigin = '';
        }
      }
      
      function toggleView() {
        const isInert = iframe.hasAttribute('inert');
        iframe.toggleAttribute('inert');
        button.setAttribute('aria-expanded', isInert);
        scaleBodyContent(isInert);
        
        liveRegion.textContent = isInert 
          ? 'Showing detailed error view' 
          : 'Showing error page';
        
        if (isInert) {
          setTimeout(function() {
            if (iframe.contentWindow) {
              try {
                iframe.contentWindow.focus();
              } catch {}
            }
          }, 100);
        } else {
          button.focus();
        }
      }
      
      button.onclick = toggleView;
      
      // Add keyboard support
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          toggleView();
        }
      });
      
      shadow.appendChild(style);
      shadow.appendChild(liveRegion);
      shadow.appendChild(iframe);
      shadow.appendChild(button);
      
      // Start with iframe maximized, body scaled down
      scaleBodyContent(true);
    } catch (error) {
      // Silently fail if Shadow DOM or any setup fails
      // The user will still see their own error page
      console.error('Failed to initialize Nuxt error overlay:', error);
    }
  })();
  `
}

export function generateErrorOverlayHTML (html: string) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  const errorPage = html.replace('<head>', `<head><script>${iframeStorageBridge(nonce)}</script>`)
  const base64HTML = Buffer.from(errorPage, 'utf8').toString('base64')
  return `
    <script>${parentStorageBridge(nonce)}</script>
    <nuxt-error-overlay></nuxt-error-overlay>
    <script>${webComponentScript(base64HTML)}</script>
  `
}
