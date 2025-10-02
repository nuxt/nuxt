export const iframeStorageBridge = (nonce: string) => /* js */ `
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
      }, window.parent.origin);
    },
    removeItem: function(key) {
      delete memoryStore[key];
      window.parent.postMessage({
        type: 'storage-remove',
        key: key,
        nonce: NONCE
      }, window.parent.origin);
    },
    clear: function() {
      for (const key in memoryStore) {
        delete memoryStore[key];
      }
      window.parent.postMessage({
        type: 'storage-clear',
        nonce: NONCE
      }, window.parent.origin);
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
    if (event.source !== iframe.contentWindow) return;
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
  }, window.parent.origin);
})();
`

export const parentStorageBridge = (nonce: string) => /* js */ `
(function() {
  const iframe = document.getElementById('pretty-errors');
  if (!iframe) return;

  const NONCE = ${JSON.stringify(nonce)}
  
  window.addEventListener('message', function(event) {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    
    if (data.nonce !== NONCE) return;
    
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
      }, iframe.contentWindow.origin || iframe.src);
    }
  });
})();
`

export const errorCSS = /* css */ `
#pretty-errors-toggle .sr-only {
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
  z-index: 999999;
  border: none;
}
#pretty-errors-toggle {
  background: none;
  z-index: 999999999;
  border: 15px #ffcdce solid;
  overflow: hidden;
  border-radius: 30px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}
#pretty-errors-toggle:hover,
#pretty-errors-toggle:focus {
  opacity: 1;
  outline: 2px solid #ff6b6b;
  outline-offset: 2px;
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
#pretty-errors:not([inert]) + #pretty-errors-toggle {
  left: 0;
  top: 0;
}
#pretty-errors[inert] {
  z-index: 999999999;
  overflow: hidden;
  border-radius: 30px;
}
#pretty-errors[inert], #pretty-errors[inert] + #pretty-errors-toggle {
  transform: scale(0.2);
  transform-origin: bottom right;
  padding: 0;
}
#pretty-errors[inert] + #pretty-errors-toggle {
  width: 100%;
  height: 100%;
}
body:has(#pretty-errors:not([inert])) {
  width: 100%;
  position: fixed;
  transform: scale(0.2);
  right: 0;
  bottom: 0;
  transform-origin: bottom right;
}
body > *:not(#pretty-errors):not(#pretty-errors-toggle) {
  position: relative;
  z-index: 9999999;
}
`
