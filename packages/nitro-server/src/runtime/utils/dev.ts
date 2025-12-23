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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  z-index: calc(var(--z-base) + 2);
  cursor: grab;
}
#pip-restore:focus-visible {
  outline: 2px solid #00DC82;
  outline-offset: 2px;
}
:host(.dragging-restore) #pip-restore {
  cursor: grabbing;
}

#frame[hidden],
#toggle[hidden],
#preview[hidden],
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
      
      const button = document.createElement('div');
      button.id = 'toggle';
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
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
      pipRestoreButton.setAttribute('aria-label', 'Show error overlay');
      pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error overlay</span>';
      pipRestoreButton.hidden = true;

      const POS_KEYS = {
        position: 'nuxt-error-overlay:position',
        hiddenPretty: 'nuxt-error-overlay:error-pip:hidden',
        hiddenPreview: 'nuxt-error-overlay:app-preview:hidden'
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

      let dock = { edge: null, offset: null, align: null, gap: null };
      let storageReady = true;
      let isPrettyHidden = false;
      let isPreviewHidden = false;
      let suppressToggleClick = false;
      let suppressRestoreClick = false;

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
      function maxOffsetFor(edge, size) {
        const vv = vvSize();
        if (edge === 'left' || edge === 'right') {
          return Math.max(MIN_GAP, vv.h - size.h - MIN_GAP);
        } else {
          return Math.max(MIN_GAP, vv.w - size.w - MIN_GAP);
        }
      }
      function clampOffset(edge, value, size) {
        const max = maxOffsetFor(edge, size);
        return Math.min(Math.max(value, MIN_GAP), max);
      }
      function sizeForTarget(target) {
        if (!target) return previewSize();
        const rect = target.getBoundingClientRect();
        if (rect.width && rect.height) {
          return { w: rect.width, h: rect.height };
        }
        return previewSize();
      }
      function updateDockAlignment(size) {
        if (!dock.edge || dock.offset == null) return;
        const max = maxOffsetFor(dock.edge, size);
        if (dock.offset <= max / 2) {
          dock.align = 'start';
          dock.gap = dock.offset;
        } else {
          dock.align = 'end';
          dock.gap = Math.max(0, max - dock.offset);
        }
      }
      function appliedOffsetFor(size) {
        if (!dock.edge || dock.offset == null) {
          return null;
        }
        const max = maxOffsetFor(dock.edge, size);
        if (dock.align === 'end' && typeof dock.gap === 'number') {
          return clampOffset(dock.edge, max - dock.gap, size);
        }
        if (dock.align === 'start' && typeof dock.gap === 'number') {
          return clampOffset(dock.edge, dock.gap, size);
        }
        return clampOffset(dock.edge, dock.offset, size);
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
          const { edge, offset, align, gap } = JSON.parse(raw);
          if (['left','right','top','bottom'].includes(edge) && typeof offset === 'number') {
            dock.edge = edge;
            dock.offset = clampOffset(edge, offset, previewSize());
            dock.align = align === 'start' || align === 'end' ? align : null;
            dock.gap = typeof gap === 'number' ? gap : null;
            if (!dock.align || dock.gap == null) {
              updateDockAlignment(previewSize());
            }
          }
        } catch {}
      }
      function persistDock() {
        if (!dock.edge || dock.offset == null) {
          return;
        }
        safeSet(POS_KEYS.position, JSON.stringify({ edge: dock.edge, offset: dock.offset, align: dock.align, gap: dock.gap }));
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
        const applied = appliedOffsetFor(previewSize());

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
      function applyDockToElement(el, opts) {
        if (!el) return;
        if (!dock.edge || dock.offset == null) {
          el.style.removeProperty('left');
          el.style.removeProperty('top');
          el.style.removeProperty('right');
          el.style.removeProperty('bottom');
          return;
        }
        el.style.left = 'auto';
        el.style.top = 'auto';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
        const applied = appliedOffsetFor(sizeForTarget(el));
        if (dock.edge === 'left') {
          el.style.left = MIN_GAP + 'px';
          el.style.top = applied + 'px';
        } else if (dock.edge === 'right') {
          el.style.right = MIN_GAP + 'px';
          el.style.top = applied + 'px';
        } else if (dock.edge === 'top') {
          el.style.top = MIN_GAP + 'px';
          el.style.left = applied + 'px';
        } else {
          el.style.bottom = MIN_GAP + 'px';
          el.style.left = applied + 'px';
        }
        if (!opts || opts.persist !== false) {
          persistDock();
        }
      }
      function applyDockAll(opts) {
        applyDockTo(CSS_VARS.pip, opts);
        applyDockTo(CSS_VARS.preview, opts);
        applyDockToElement(pipRestoreButton, opts);
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
        const rawPretty = safeGet(POS_KEYS.hiddenPretty);
        if (rawPretty != null) {
          isPrettyHidden = (rawPretty === '1' || rawPretty === 'true');
        }
        const rawPreview = safeGet(POS_KEYS.hiddenPreview);
        if (rawPreview != null) {
          isPreviewHidden = (rawPreview === '1' || rawPreview === 'true');
        }
      }
      function setPrettyHidden(v) {
        isPrettyHidden = !!v;
        safeSet(POS_KEYS.hiddenPretty, isPrettyHidden ? '1' : '0');
        updateUI();
      }
      function setPreviewHidden(v) {
        isPreviewHidden = !!v;
        safeSet(POS_KEYS.hiddenPreview, isPreviewHidden ? '1' : '0');
        updateUI();
      }
      function isMinimized() {
        return iframe.hasAttribute('inert');
      }
      function setMinimized(v) {
        if (v) {
          iframe.setAttribute('inert', '');
          button.setAttribute('aria-expanded', 'false');
        } else {
          iframe.removeAttribute('inert');
          button.setAttribute('aria-expanded', 'true');
        }
      }
      function setHidden(el, hidden) {
        el.toggleAttribute('hidden', !!hidden);
      }
      function setRestoreLabel(kind) {
        if (kind === 'pretty') {
          pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error overlay</span>';
          pipRestoreButton.setAttribute('aria-label', 'Show error overlay');
        } else if (kind === 'preview') {
          pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error page</span>';
          pipRestoreButton.setAttribute('aria-label', 'Show error page');
        }
      }

      function updateUI() {
        const minimized = isMinimized();
        const showPiP = minimized && !isPrettyHidden;
        const showPreview = !minimized && !isPreviewHidden;
        const pipHiddenByUser = minimized && isPrettyHidden;
        const previewHiddenByUser = !minimized && isPreviewHidden;
        const showToggle = minimized ? showPiP : showPreview;
        const showRestore = pipHiddenByUser || previewHiddenByUser;

        setHidden(iframe, pipHiddenByUser);
        setHidden(preview, !showPreview);
        setHidden(button, !showToggle);
        setHidden(pipCloseButton, !showToggle);
        pipCloseButton.setAttribute('aria-label', minimized ? 'Hide error overlay' : 'Hide error page preview');
        setHidden(pipRestoreButton, !showRestore);
        if (pipHiddenByUser) {
          setRestoreLabel('pretty');
        } else if (previewHiddenByUser) {
          setRestoreLabel('preview');
        }
        host.classList.toggle('pip-hidden', isPrettyHidden);
        host.classList.toggle('preview-hidden', isPreviewHidden);
      }

      function loadState() {
        loadDock();
        loadHidden();
        if (isPrettyHidden && !isMinimized()) {
          setMinimized(true);
        }
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
          setMinimized(false);
          liveRegion.textContent = 'Showing detailed error view';
          setTimeout(function() {
            try { iframe.contentWindow.focus(); } catch {}
          }, 100);
        } else {
          setMinimized(true);
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
      button.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleView();
        }
      });
      pipCloseButton.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (isMinimized()) {
          setPrettyHidden(true);
        } else {
          setPreviewHidden(true);
        }
      });
      pipCloseButton.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
      pipRestoreButton.addEventListener('click', function (e) {
        if (suppressRestoreClick) {
          e.preventDefault();
          suppressRestoreClick = false;
          return;
        }
        e.preventDefault(); e.stopPropagation();
        if (isMinimized()) {
          setPrettyHidden(false);
        } else {
          setPreviewHidden(false);
        }
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
        const isRestoreTarget = e.currentTarget === pipRestoreButton;
        drag = {
          kind: isRestoreTarget ? 'restore' : (isMinimized() ? 'pip' : 'preview'),
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          moved: false,
          target: e.currentTarget
        };
        drag.target.setPointerCapture(e.pointerId);
        if (drag.kind === 'restore') {
          host.classList.add('dragging-restore');
        } else {
          host.classList.add(drag.kind === 'pip' ? 'dragging' : 'dragging-preview');
        }
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
          const size = sizeForTarget(drag.target);
          let offset;
          if (edge === 'left' || edge === 'right') {
            // Offset along vertical axis (top)
            const top = drag.lastY - (size.h / 2);
            offset = clampOffset(edge, Math.round(top), size);
          } else {
            // top/bottom: offset along horizontal axis (left)
            const left = drag.lastX - (size.w / 2);
            offset = clampOffset(edge, Math.round(left), size);
          }
          dock.edge = edge;
          dock.offset = offset;
          updateDockAlignment(size);
          const origin = currentTransformOrigin();
          host.style.setProperty('--error-pip-origin', origin || 'bottom right');
          applyDockAll({ origin: origin, persist: false });
        });
      }

      function endDrag(e) {
        if (!drag || drag.pointerId !== e.pointerId) return;
        const endedKind = drag.kind;
        drag.target.releasePointerCapture(e.pointerId);
        if (endedKind === 'restore') {
          host.classList.remove('dragging-restore');
        } else {
          host.classList.remove(endedKind === 'pip' ? 'dragging' : 'dragging-preview');
        }
        const didMove = drag.moved;
        drag = null;
        if (didMove) {
          // Persist final dock once
          persistDock();
          if (endedKind === 'restore') {
            suppressRestoreClick = true;
          } else {
            suppressToggleClick = true;
          }
          e.preventDefault();
          e.stopPropagation();
        }
      }

      function bindDragTarget(el) {
        el.addEventListener('pointerdown', beginDrag);
        el.addEventListener('pointermove', moveDrag);
        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);
      }
      bindDragTarget(button);
      bindDragTarget(pipRestoreButton);

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
        setMinimized(true);
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
