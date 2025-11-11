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
      const iframe = host.shadowRoot.getElementById('frame');
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
  --preview-width: 240px;
  --preview-height: 180px;
  --base-width: 1200px;
  --base-height: 900px;
  --z-base: 999999998;
  --error-pip-left: auto;
  --error-pip-top: auto;
  --error-pip-right: 5px;
  --error-pip-bottom: 5px;
  --error-pip-origin: bottom right;
  --app-preview-left: auto;
  --app-preview-top: auto;
  --app-preview-right: 5px;
  --app-preview-bottom: 5px;
  all: initial;
  display: contents;
}
.sr-only {
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
#frame {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  border: none;
  z-index: var(--z-base);
}
#frame[inert] {
  left: var(--error-pip-left);
  top: var(--error-pip-top);
  right: var(--error-pip-right);
  bottom: var(--error-pip-bottom);
  width: var(--base-width);
  height: var(--base-height);
  transform: scale(calc(240 / 1200));
  transform-origin: var(--error-pip-origin);
  overflow: hidden;
  border-radius: calc(1200 * 8px / 240);
}
#preview {
  position: fixed;
  left: var(--app-preview-left);
  top: var(--app-preview-top);
  right: var(--app-preview-right);
  bottom: var(--app-preview-bottom);
  width: var(--preview-width);
  height: var(--preview-height);
  overflow: hidden;
  border-radius: 8px;
  pointer-events: none;
  z-index: var(--z-base);
  background: white;
  display: none;
}
#preview iframe {
  transform-origin: var(--error-pip-origin);
}
#frame:not([inert]) + #preview {
  display: block;
}
#toggle {
  position: fixed;
  left: var(--app-preview-left);
  top: var(--app-preview-top);
  right: var(--app-preview-right);
  bottom: var(--app-preview-bottom);
  width: var(--preview-width);
  height: var(--preview-height);
  background: none;
  border: 3px solid #00DC82;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, box-shadow 0.2s;
  z-index: calc(var(--z-base) + 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
#toggle:hover,
#toggle:focus {
  opacity: 1;
  box-shadow: 0 0 20px rgba(0, 220, 130, 0.6);
}
#toggle:focus-visible {
  outline: 3px solid #00DC82;
  outline-offset: 3px;
  box-shadow: 0 0 24px rgba(0, 220, 130, 0.8);
}
#frame[inert] ~ #toggle {
  left: var(--error-pip-left);
  top: var(--error-pip-top);
  right: var(--error-pip-right);
  bottom: var(--error-pip-bottom);
  cursor: grab;
}
:host(.dragging) #frame[inert] ~ #toggle {
  cursor: grabbing;
}
#frame:not([inert]) ~ #toggle,
#frame:not([inert]) + #preview {
  cursor: grab;
}
:host(.dragging-preview) #frame:not([inert]) ~ #toggle,
:host(.dragging-preview) #frame:not([inert]) + #preview {
  cursor: grabbing;
}

#pip-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}
#pip-close:focus-visible {
  outline: 2px solid #00DC82;
  outline-offset: 2px;
}

#pip-restore {
  position: fixed;
  right: 16px;
  bottom: 16px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 2px solid #00DC82;
  background: #111;
  color: #fff;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  z-index: calc(var(--z-base) + 2);
}
#pip-restore:focus-visible {
  outline: 2px solid #00DC82;
  outline-offset: 2px;
}

#frame[hidden],
#toggle[hidden],
#pip-restore[hidden],
#pip-close[hidden] {
  display: none !important;
}

@media (prefers-reduced-motion: reduce) {
  #toggle {
    transition: none;
  }
}
`

function webComponentScript (base64HTML: string, startMinimized: boolean) {
  return /* js */ `
  (function() {
    try {
      const host = document.querySelector('nuxt-error-overlay');
      if (!host) return;
      
      const shadow = host.attachShadow({ mode: 'open' });
      
      // Create elements
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(errorCSS)};
      
      const iframe = document.createElement('iframe');
      iframe.id = 'frame';
      iframe.src = 'data:text/html;base64,${base64HTML}';
      iframe.title = 'Detailed error stack trace';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      
      const preview = document.createElement('div');
      preview.id = 'preview';
      
      const button = document.createElement('button');
      button.id = 'toggle';
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('type', 'button');
      button.innerHTML = '<span class="sr-only">Toggle detailed error view</span>';
      
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      
      const pipCloseButton = document.createElement('button');
      pipCloseButton.id = 'pip-close';
      pipCloseButton.setAttribute('type', 'button');
      pipCloseButton.setAttribute('aria-label', 'Hide error preview overlay');
      pipCloseButton.textContent = 'x';
      pipCloseButton.hidden = true;
      button.appendChild(pipCloseButton);

      const pipRestoreButton = document.createElement('button');
      pipRestoreButton.id = 'pip-restore';
      pipRestoreButton.setAttribute('type', 'button');
      pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error overlay</span>';
      pipRestoreButton.hidden = true;

      const POS_KEYS = {
        position: 'nuxt-error-overlay:position',
        hidden: 'nuxt-error-overlay:error-pip:hidden'
      };

      const CSS_VARS = {
        pip: { 
          left: '--error-pip-left',
          top: '--error-pip-top',
          right: '--error-pip-right',
          bottom: '--error-pip-bottom',
        },
        preview: {
          left: '--app-preview-left',
          top: '--app-preview-top',
          right: '--app-preview-right',
          bottom: '--app-preview-bottom'
        }
      };

      const MIN_GAP = 5;
      const DRAG_THRESHOLD = 2;

      let dock = { edge: null, offset: null };
      let storageReady = true;
      let isHidden = false;
      let suppressToggleClick = false;

      function vvSize() {
        const v = window.visualViewport;
        return v ? { w: v.width, h: v.height } : { w: window.innerWidth, h: window.innerHeight };
      }
      function previewSize() {
        const styles = getComputedStyle(host);
        const w = parseFloat(styles.getPropertyValue('--preview-width')) || 240;
        const h = parseFloat(styles.getPropertyValue('--preview-height')) || 180;
        return { w: w, h: h };
      }
      function maxOffsetFor(edge) {
        const size = previewSize();
        const vv = vvSize();
        if (edge === 'left' || edge === 'right') {
          return Math.max(MIN_GAP, vv.h - size.h - MIN_GAP);
        } else {
          return Math.max(MIN_GAP, vv.w - size.w - MIN_GAP);
        }
      }
      function clampOffset(edge, value) {
        const max = maxOffsetFor(edge);
        return Math.min(Math.max(value, MIN_GAP), max);
      }
      function nearestEdgeAt(x, y) {
        const { w, h } = vvSize();
        const d = { left: x, right: w - x, top: y, bottom: h - y };
        return Object.keys(d).reduce((a, b) => d[a] < d[b] ? a : b);
      }  
      function cornerDefaultDock() {
        // default to bottom-right, offset is distance from left for 'top/bottom' and from top for 'left/right'
        // we pick bottom with right as default: bottom + offset from left (so it appears bottom-right)
        const vv = vvSize();
        const size = previewSize();
        // For bottom edge, offset is left coordinate
        const offset = Math.max(MIN_GAP, vv.w - size.w - MIN_GAP);
        return { edge: 'bottom', offset: offset };
      }

      function safeGet(k) { 
        try { 
          return localStorage.getItem(k);
        } catch (e) {
          return null; 
        }
      }
      function safeSet(k, v) {
        if (!storageReady) return;
        try {
          localStorage.setItem(k, v);
        } catch (e) {}
      }

      function loadDock() {
        const raw = safeGet(POS_KEYS.position);
        if (!raw) {
          return;
        }
        try {
          const { edge, offset } = JSON.parse(raw);
          if (['left','right','top','bottom'].includes(edge) && typeof offset === 'number') {
            dock.edge = edge;
            dock.offset = clampOffset(edge, offset);
          }
        } catch {}
      }
      function persistDock() {
        if (!dock.edge || dock.offset == null) {
          return;
        }
        safeSet(POS_KEYS.position, JSON.stringify({ edge: dock.edge, offset: dock.offset }));
      }
      function applyDockTo(vars, opts) {
        // Clear if not set
        if (!dock.edge || dock.offset == null) {
          host.style.removeProperty(vars.left);
          host.style.removeProperty(vars.top);
          host.style.removeProperty(vars.right);
          host.style.removeProperty(vars.bottom);
          return;
        }
        // Reset all sides to 'auto' first to avoid stale anchors
        host.style.setProperty(vars.left, 'auto');
        host.style.setProperty(vars.top, 'auto');
        host.style.setProperty(vars.bottom, 'auto');
        host.style.setProperty(vars.right, 'auto');
        // Anchor to the chosen edge and place by offset
        const applied = clampOffset(dock.edge, dock.offset);

        if (dock.edge === 'left') {
          host.style.setProperty(vars.left, MIN_GAP + 'px');
          host.style.setProperty(vars.top, applied + 'px');
        } else if (dock.edge === 'right') {
          host.style.setProperty(vars.right, MIN_GAP + 'px');
          host.style.setProperty(vars.top, applied + 'px');
        } else if (dock.edge === 'top') {
          host.style.setProperty(vars.top, MIN_GAP + 'px');
          host.style.setProperty(vars.left, applied + 'px');
        } else {
          host.style.setProperty(vars.bottom, MIN_GAP + 'px');
          host.style.setProperty(vars.left, applied + 'px');
        }
        if (!opts || opts.persist !== false) {
          persistDock();
        }
      }
      function applyDockAll(opts) {
        applyDockTo(CSS_VARS.pip, opts);
        applyDockTo(CSS_VARS.preview, opts);
      }
      function currentTransformOrigin() {
        if (!dock.edge) {
          return null;
        }
        if (dock.edge === 'left' || dock.edge === 'top') {
          return 'top left';
        }
        if (dock.edge === 'right') {
          return 'top right';
        }
        return 'bottom left';
      }

      function loadHidden() {
        const raw = safeGet(POS_KEYS.hidden);
        if (raw != null) {
          isHidden = (raw === '1' || raw === 'true');
        }
      }
      function setHidden(v) {
        isHidden = !!v;
        safeSet(POS_KEYS.hidden, isHidden ? '1' : '0');
        updateUI();
      }
      function isMinimized() {
        return iframe.hasAttribute('inert');
      }

      function updateUI() {
        const minimized = isMinimized();
        const showPiP = minimized && !isHidden;
        const pipHiddenByUser = minimized && isHidden;
        const showToggle = !minimized || showPiP;

        iframe.toggleAttribute('hidden', pipHiddenByUser);
        button.toggleAttribute('hidden', !showToggle);
        pipRestoreButton.toggleAttribute('hidden', !pipHiddenByUser);
        pipCloseButton.toggleAttribute('hidden', !showPiP);
        host.classList.toggle('pip-hidden', isHidden);
      }

      function loadState() {
        loadDock();
        loadHidden();
        updateUI();
        repaintToDock();
      }
      
      // initial state load
      loadState();

      window.addEventListener('storage-ready', function () {
        storageReady = true;
        loadState();
      });

      // --- preview snapshot for background ---
      function updatePreview() {
        try {
          let previewIframe = preview.querySelector('iframe');
          if (!previewIframe) {
            previewIframe = document.createElement('iframe');
            previewIframe.style.cssText = 'width: 1200px; height: 900px; transform: scale(0.2); transform-origin: top left; border: none;';
            previewIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            preview.appendChild(previewIframe);
          }
          
          const doctype = document.doctype ? '<!DOCTYPE ' + document.doctype.name + '>' : '';
          const cleanedHTML = document.documentElement.outerHTML
            .replace(/<nuxt-error-overlay[^>]*>.*?<\\/nuxt-error-overlay>/gs, '')
            .replace(/<script[^>]*>.*?<\\/script>/gs, '');
          
          const iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(doctype + cleanedHTML);
          iframeDoc.close();
        } catch (error) {
          console.error('Failed to update preview:', error);
        }
      }

      function toggleView() {
        if (isMinimized()) {
          updatePreview();
          iframe.removeAttribute('inert');
          button.setAttribute('aria-expanded', 'true');
          liveRegion.textContent = 'Showing detailed error view';
          setTimeout(function() {
            try { iframe.contentWindow.focus(); } catch {}
          }, 100);
        } else {
          iframe.setAttribute('inert', '');
          button.setAttribute('aria-expanded', 'false');
          liveRegion.textContent = 'Showing error page';
          repaintToDock();
          // ensure paint if no stored state yet
          void iframe.offsetWidth;
        }
        updateUI();
      }

      button.addEventListener('click', function (e) {
        if (suppressToggleClick) {
          e.preventDefault();
          suppressToggleClick = false;
          return;
        }
        toggleView();
      });
      pipCloseButton.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (isMinimized())
          setHidden(true);
      });
      pipCloseButton.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
      pipRestoreButton.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        setHidden(false);
      });

      // --- unified dragging with requestAnimationFrame throttle ---
      let drag = null;
      let rafId = null;

      function beginDrag(e) {
        if (drag) return;
        // Decide starting edge: use stored, or nearest to pointer
        if (!dock.edge || dock.offset == null) {
          dock = cornerDefaultDock();
        }
        drag = {
          kind: isMinimized() ? 'pip' : 'preview',
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          moved: false
        };
        button.setPointerCapture(e.pointerId);
        host.classList.add(drag.kind === 'pip' ? 'dragging' : 'dragging-preview');
        e.preventDefault();
      }

      function moveDrag(e) {
        if (!drag || drag.pointerId !== e.pointerId) 
          return;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        const dx = drag.lastX - drag.startX;
        const dy = drag.lastY - drag.startY;
        if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          drag.moved = true;
        }
        if (!drag.moved) 
          return;

        if (rafId) return;
        rafId = requestAnimationFrame(function () {
          rafId = null;
          // Snap to nearest edge at current pointer
          const edge = nearestEdgeAt(drag.lastX, drag.lastY);
          const size = previewSize();
          let offset;
          if (edge === 'left' || edge === 'right') {
            // Offset along vertical axis (top)
            const top = drag.lastY - (size.h / 2);
            offset = clampOffset(edge, Math.round(top));
          } else {
            // top/bottom: offset along horizontal axis (left)
            const left = drag.lastX - (size.w / 2);
            offset = clampOffset(edge, Math.round(left));
          }
          dock.edge = edge;
          dock.offset = offset;
          const origin = currentTransformOrigin();
          host.style.setProperty('--error-pip-origin', origin || 'bottom right');
          applyDockAll({ origin: origin, persist: false });
        });
      }

      function endDrag(e) {
        if (!drag || drag.pointerId !== e.pointerId) return;
        const endedKind = drag.kind;
        button.releasePointerCapture(e.pointerId);
        host.classList.remove(endedKind === 'pip' ? 'dragging' : 'dragging-preview');
        const didMove = drag.moved;
        drag = null;
        if (didMove) {
          // Persist final dock once
          persistDock();
          suppressToggleClick = true;
          e.preventDefault();
          e.stopPropagation();
        }
      }

      button.addEventListener('pointerdown', beginDrag);
      button.addEventListener('pointermove', moveDrag);
      button.addEventListener('pointerup', endDrag);
      button.addEventListener('pointercancel', endDrag);

      // keep positions in-bounds on viewport / visualViewport changes
      function repaintToDock() {
        if (!dock.edge || dock.offset == null) {
          return;
        }
        const origin = currentTransformOrigin();
        if (origin) {
          host.style.setProperty('--error-pip-origin', origin);
        } else {
          host.style.removeProperty('--error-pip-origin');
        }
        applyDockAll({ origin: origin, persist: false });
      }

      window.addEventListener('resize', function () {
        repaintToDock();
      });

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function () {
          repaintToDock();
        });

        window.visualViewport.addEventListener('scroll', function () {
          repaintToDock();
        });
      }

      // Append to shadow DOM (order matters: #frame + #preview adjacency)
      shadow.appendChild(style);
      shadow.appendChild(liveRegion);
      shadow.appendChild(iframe);
      shadow.appendChild(preview);
      shadow.appendChild(button);
      shadow.appendChild(pipRestoreButton);
      
      if (${startMinimized}) {
        iframe.setAttribute('inert', '');
        button.setAttribute('aria-expanded', 'false');
        repaintToDock();
        void iframe.offsetWidth;
        updateUI();
      }
      
      // Initialize preview
      setTimeout(updatePreview, 100);
      
    } catch (error) {
      console.error('Failed to initialize Nuxt error overlay:', error);
    }
  })();
  `
}

export function generateErrorOverlayHTML (html: string, options?: { startMinimized?: boolean }) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  const errorPage = html.replace('<head>', `<head><script>${iframeStorageBridge(nonce)}</script>`)
  const base64HTML = Buffer.from(errorPage, 'utf8').toString('base64')
  return `
    <script>${parentStorageBridge(nonce)}</script>
    <nuxt-error-overlay></nuxt-error-overlay>
    <script>${webComponentScript(base64HTML, options?.startMinimized ?? false)}</script>
  `
}
