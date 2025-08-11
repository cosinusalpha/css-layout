class CSSEditor {
    constructor(app) {
        this.app = app;
    // Device used for editing per-element responsive styles (separate from preview width)
    this.propertyEditDevice = 'desktop';
    // Explicit device state for preview (avoid relying on measured widths which can be stale)
    this.currentDevice = 'desktop';
    // Multi-select support
    this.multiSelected = new Set();
    this.draggingEl = null;
    this.dragOverEl = null;
    this.dragGroup = null; // array of elements when multi-drag
    this._dndInsertMarker = null;
    this.copiedStyles = null; // for copy/paste styles
    this.prefs = { autoUpdate:true, prune:true, codeFormat:'css', minify:false, editDevice:'desktop' };
    // History & persistence state
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 80;
    this._historyDebounce = null;
    this._pendingHistoryLabel = null;
    document.addEventListener('keydown', (e) => this.handleKeyShortcuts(e));
    this.render();
    this.loadPreferences();
    this.applyPreferencesToUI();
    this.installPreferenceBindings();
    // Attempt auto-restore from last session (best-effort)
    this.autoRestoreFromLocal();
    // Initial snapshot (empty canvas)
    this.captureSnapshot('init');
    }

    render() {
        this.app.innerHTML = `
            <div class="panel" id="left-panel">
                <h2>Elements</h2>
                <div id="element-controls">
                    <button id="add-row-btn">Add Row</button>
                    <button id="add-col-btn">Add Column</button>
                    <button id="add-grid-btn">Add Grid</button>
                    <div class="history-row">
                        <button id="undo-btn" class="history-btn" title="Undo (Ctrl+Z)" disabled>Undo</button>
                        <button id="redo-btn" class="history-btn" title="Redo (Ctrl+Y)" disabled>Redo</button>
                    </div>
                    <button id="save-layout-btn" style="background:#198754;">Save</button>
                    <button id="load-layout-btn" style="background:#6c757d;">Load</button>
                    <input type="file" id="load-file-input" accept="application/json" style="display:none;" />
                </div>
                <button id="clear-btn">Clear Canvas</button>
                <div class="preset-container">
                    <label for="preset-select">Presets</label>
                    <select id="preset-select">
                        <option value="">Select a preset</option>
                        <option value="header-content-footer">Header / Content / Footer</option>
                        <option value="sidebar-layout">Sidebar (Left) + Content</option>
                        <option value="sidebar-right-layout">Sidebar (Right) + Content</option>
                        <option value="dashboard-app-shell">App Shell (Header / Sidebar / Main)</option>
                        <option value="grid-2col-hero">Marketing Hero (2 Columns)</option>
                        <option value="grid-gallery">Image Gallery Grid</option>
                        <option value="form-page">Form Page (Title + Form + Sidebar tips)</option>
                        <option value="win-classic">Desktop App (Menu / Sidebar / Workspace / Status)</option>
                        <option value="blog-post">Blog Post (Title / Meta / Body / Aside)</option>
                    </select>
                </div>
                <div class="component-section">
                    <h3 class="mini-h">Components</h3>
                    <div class="component-controls">
                        <input type="text" id="component-name" placeholder="Name" />
                        <button id="save-component-btn" title="Save selected subtree as component" disabled>Save Sel</button>
                    </div>
                    <ul id="component-list" aria-label="Saved components"></ul>
                </div>
            </div>
            <div id="canvas">
                <div id="device-controls">
                    <button id="desktop-btn" class="active">Desktop</button>
                    <button id="tablet-btn">Tablet</button>
                    <button id="mobile-btn">Mobile</button>
                </div>
                <div id="preview-container">
                    <div id="preview"></div>
                </div>
            </div>
            <div class="panel" id="right-panel">
                <div id="properties-section">
                    <div class="section-header">
                        <h2>Properties</h2>
                        <div id="prop-device-tabs" aria-label="Edit breakpoints">
                            <button data-dev="desktop" class="active" title="Edit desktop styles">D</button>
                            <button data-dev="tablet" title="Edit tablet styles">T</button>
                            <button data-dev="mobile" title="Edit mobile styles">M</button>
                        </div>
                    </div>
                    <div id="breadcrumb" class="breadcrumb"></div>
                    <div id="properties-panel-content">
                        <p>Select an element to edit its properties.</p>
                    </div>
                </div>
                <div id="code-section">
                    <h2>Code</h2>
                    <div id="code-panel-content">
                        <div class="code-format-container">
                            <label for="code-format-select">Format</label>
                            <select id="code-format-select">
                                <option value="css">Pure CSS</option>
                                <option value="tailwind">Tailwind CSS</option>
                            </select>
                        </div>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.7rem; margin:4px 0 6px;">
                            <input type="checkbox" id="prune-overrides-export" checked>
                            <span>Prune redundant overrides on export</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.7rem; margin:0 0 6px;">
                            <input type="checkbox" id="minify-export">
                            <span>Minify HTML & CSS</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.7rem; margin:0 0 10px;">
                            <input type="checkbox" id="remember-splits">
                            <span>Remember split sizes (export)</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.7rem; margin:6px 0 10px;">
                            <input type="checkbox" id="auto-update-code" checked>
                            <span>Auto Update Code</span>
                        </label>
                        <button id="generate-code-btn">Generate Code</button>
                        <button id="run-validation-btn" class="secondary-action" style="margin-top:4px;">Run Validation</button>
                        <button id="open-code-modal-btn">Open Large Viewer</button>
                        <pre id="html-code"></pre>
                        <pre id="css-code"></pre>
                        <div id="validation-results" class="validation-results" aria-live="polite"></div>
                    </div>
                </div>
            </div>
            <div id="code-modal-overlay">
                <div id="code-modal" role="dialog" aria-modal="true" aria-label="Generated Code">
                    <header>
                        <h3>Generated Code</h3>
                        <button class="close-btn" id="close-code-modal">Close</button>
                    </header>
                    <div class="tab-bar">
                        <button class="code-tab active" data-target="modal-html">HTML</button>
                        <button class="code-tab" data-target="modal-css">CSS</button>
                    </div>
                    <div class="code-pane" id="modal-html" data-kind="html"><pre id="modal-html-pre"></pre></div>
                    <div class="code-pane" id="modal-css" data-kind="css" style="display:none;"><pre id="modal-css-pre"></pre></div>
                    <div class="actions">
                        <button id="copy-current-btn">Copy Current Tab</button>
                        <button id="copy-all-btn" class="secondary">Copy Both</button>
                        <button id="download-zip-btn" class="secondary">Download Files</button>
                    </div>
                </div>
            </div>`;

        this.preview = this.app.querySelector('#preview');

        this.app.querySelector('#desktop-btn').addEventListener('click', () => this.setDevice('desktop'));
        this.app.querySelector('#tablet-btn').addEventListener('click', () => this.setDevice('tablet'));
        this.app.querySelector('#mobile-btn').addEventListener('click', () => this.setDevice('mobile'));

    this.app.querySelector('#add-row-btn').addEventListener('click', () => this.addElement('row'));
        this.app.querySelector('#add-col-btn').addEventListener('click', () => this.addElement('col'));
    this.app.querySelector('#add-grid-btn').addEventListener('click', () => this.addElement('grid'));
    this.app.querySelector('#save-layout-btn').addEventListener('click', () => this.downloadLayout());
    this.app.querySelector('#load-layout-btn').addEventListener('click', () => this.app.querySelector('#load-file-input').click());
    this.app.querySelector('#load-file-input').addEventListener('change', (e)=> this.handleFileLoad(e));
    // History buttons
    this.app.querySelector('#undo-btn').addEventListener('click', () => { this.undo(); });
    this.app.querySelector('#redo-btn').addEventListener('click', () => { this.redo(); });

    this.selectedElement = null;
        this.preview.addEventListener('click', (e) => this.selectElement(e));
        this.app.querySelector('#generate-code-btn').addEventListener('click', () => this.generateCode());
    this.app.querySelector('#open-code-modal-btn').addEventListener('click', () => this.openCodeModal());
        this.app.querySelector('#clear-btn').addEventListener('click', () => this.clearCanvas());
        this.app.querySelector('#preset-select').addEventListener('change', (e) => this.loadPreset(e.target.value));
    this.app.querySelector('#run-validation-btn').addEventListener('click', ()=> this.runValidation());
    // Component events
    this.loadComponents();
    this.renderComponentList();
    this.app.querySelector('#component-name').addEventListener('input', ()=> this.updateComponentSaveButton());
    this.app.querySelector('#save-component-btn').addEventListener('click', ()=> this.saveCurrentComponent());

        // Property edit device tabs
        this.app.addEventListener('click', (e) => {
            const btn = e.target.closest('#prop-device-tabs button');
            if (btn) {
                const dev = btn.dataset.dev;
                this.setActivePropertyDevice(dev);
                this.app.querySelectorAll('#prop-device-tabs button').forEach(b=>b.classList.toggle('active', b===btn));
            }
        });
    }

    setDevice(device) {
        this.currentDevice = device;
        this.preview.style.width = {
            'desktop': '100%',
            'tablet': '768px',
            'mobile': '375px'
        }[device];
        document.querySelectorAll('#device-controls button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`#${device}-btn`).classList.add('active');
        this.applyStyles();
    }

    addElement(type) {
        const newElement = document.createElement('div');
        newElement.classList.add(type);
        newElement.textContent = type.charAt(0).toUpperCase() + type.slice(1);

        // Initialize a styles dataset so that code generation always has something to work with
        let baseStyles;
        if (type === 'grid') {
            newElement.classList.remove('grid');
            newElement.classList.add('grid-container');
            // Remove default label text so it doesn't occupy a grid cell
            newElement.textContent = '';
            baseStyles = {
                desktop: {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px'
                },
                tablet: {},
                mobile: {}
            };
            newElement.dataset.gridStack = 'false';
        } else {
            baseStyles = {
                desktop: {
                    display: 'flex',
                    flexDirection: type === 'row' ? 'row' : 'column',
                    flexGrow: '1',
                },
                tablet: {},
                mobile: {}
            };
        }
        newElement.dataset.styles = JSON.stringify(baseStyles);
        newElement.dataset.responsiveStack = 'false';

        let target = this.selectedElement && (this.selectedElement.classList.contains('row') || this.selectedElement.classList.contains('col'))
            ? this.selectedElement
            : this.preview;

        // If adding a column directly to the root preview, auto-wrap in (or reuse) a row container
        if (type === 'col' && target === this.preview) {
            let last = this.preview.lastElementChild;
            if (!last || !last.classList.contains('row')) {
                const rowWrapper = document.createElement('div');
                rowWrapper.classList.add('row');
                const rowBaseStyles = {
                    desktop: { display: 'flex', flexDirection: 'row', flexGrow: '1' },
                    tablet: {},
                    mobile: {}
                };
                rowWrapper.dataset.styles = JSON.stringify(rowBaseStyles);
                rowWrapper.dataset.responsiveStack = 'false';
                this.preview.appendChild(rowWrapper);
                last = rowWrapper;
            }
            target = last; // append into existing/created row
        }

        if (type === 'grid') {
            for (let i = 0; i < 2; i++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-item');
                cell.textContent = `Cell ${i+1}`;
                cell.dataset.styles = JSON.stringify({ desktop: {}, tablet: {}, mobile: {} });
                cell.dataset.responsiveStack = 'false';
                cell.dataset.gridStack = 'false';
                newElement.appendChild(cell);
            }
        }

        target.appendChild(newElement);
        this.applyStyles();
    this.captureSnapshot('add:'+type);
    }

    selectElement(e) {
        const target = e.target;
        if (target === this.preview) return;
        const isModifier = e.metaKey || e.ctrlKey;
        const isShift = e.shiftKey;
        // Initialize selection baseline
        if (!isModifier && !isShift) {
            // Clear previous
            this.multiSelected.forEach(el => el.classList.remove('selected')); this.multiSelected.clear();
        }
        let toSelect = [target];
        if (isShift && this.selectedElement && this.selectedElement.parentElement === target.parentElement) {
            const siblings = Array.from(target.parentElement.children);
            const a = siblings.indexOf(this.selectedElement);
            const b = siblings.indexOf(target);
            if (a !== -1 && b !== -1) {
                const [min,max] = a < b ? [a,b] : [b,a];
                toSelect = siblings.slice(min, max+1);
            }
        }
        toSelect.forEach(el => {
            if (this.multiSelected.has(el) && (isModifier || isShift)) {
                // toggle off
                this.multiSelected.delete(el);
                el.classList.remove('selected');
            } else {
                this.multiSelected.add(el);
                el.classList.add('selected');
            }
        });
        // Primary selectedElement is last in toSelect that is still selected
        const last = toSelect[toSelect.length-1];
        if (last && this.multiSelected.has(last)) this.selectedElement = last;
        else this.selectedElement = this.multiSelected.size ? Array.from(this.multiSelected).slice(-1)[0] : null;
        this.updatePropertiesPanel();
        e.stopPropagation();
    }


    generateTailwind(element) {
        // Add base flex container to the root if it has children
        if (element.children.length > 0) {
            let rootDisplay = 'flex';
            if (Array.from(element.children).some(ch => ch.classList.contains('grid-container'))) rootDisplay = 'grid';
            element.className = rootDisplay;
        }

        element.querySelectorAll('*').forEach(el => {
            if (el.dataset.styles) {
                const styles = JSON.parse(el.dataset.styles);
                
                // Handle visibility for Tailwind export
                if (styles.desktop?.__hidden) {
                    if (!styles.desktop) styles.desktop = {};
                    styles.desktop.display = 'none';
                }
                if (styles.tablet?.__hidden) {
                    if (!styles.tablet) styles.tablet = {};
                    styles.tablet.display = 'none';
                }
                if (styles.mobile?.__hidden) {
                    if (!styles.mobile) styles.mobile = {};
                    styles.mobile.display = 'none';
                }

                let classes = [];
                const isGrid = el.classList.contains('grid-container');
                if (isGrid) {
                    classes.push('grid');
                } else if (el.children.length > 0) {
                    classes.push('flex');
                }
                
                for (const device in styles) {
                    const prefix = device === 'desktop' ? '' : (device === 'tablet' ? 'md:' : 'sm:');
                    const deviceStyles = styles[device];
                    for (const prop in deviceStyles) {
                        const tw = this.getTailwindClass(prop, deviceStyles[prop]);
                        if (tw) classes.push(`${prefix}${tw}`);
                    }
                }
                el.className = classes.join(' ').trim();
            }
        });
    }

    getTailwindClass(prop, value) {
        // Enhanced mapping for better Tailwind CSS generation
        const mapping = {
            display: { flex: 'flex', block: 'block', 'inline-block': 'inline-block', none: 'hidden', grid: 'grid' },
            flexDirection: { row: 'flex-row', column: 'flex-col' },
            gap: (v) => {
                const predefined = { '0':'gap-0','2px':'gap-px','4px':'gap-1','8px':'gap-2','12px':'gap-3','16px':'gap-4','20px':'gap-5','24px':'gap-6','28px':'gap-7','32px':'gap-8','40px':'gap-10','48px':'gap-12'};
                return predefined[v] || `gap-[${v}]`;
            },
            gridTemplateColumns: (v) => {
                const parts = v.trim().split(/\s+/);
                if (parts.every(p => p === '1fr')) return `grid-cols-${parts.length}`;
                return `grid-cols-[${v.replace(/\s+/g,'_')}]`;
            },
            gridColumn: (v) => {
                const m = v.match(/span\s+(\d+)/); return m ? `col-span-${m[1]}` : '';
            },
            gridRow: (v) => {
                const m = v.match(/span\s+(\d+)/); return m ? `row-span-${m[1]}` : '';
            },
            justifyContent: { 
                'flex-start': 'justify-start', 
                'flex-end': 'justify-end', 
                center: 'justify-center', 
                'space-between': 'justify-between', 
                'space-around': 'justify-around',
                'space-evenly': 'justify-evenly'
            },
            alignItems: { 
                'flex-start': 'items-start', 
                'flex-end': 'items-end', 
                center: 'items-center', 
                stretch: 'items-stretch', 
                baseline: 'items-baseline' 
            },
            justifyItems: { start:'justify-items-start', end:'justify-items-end', center:'justify-items-center', stretch:'justify-items-stretch' },
            width: (v) => {
                if (v === '100%') return 'w-full';
                if (v === '50%') return 'w-1/2';
                if (v === '25%') return 'w-1/4';
                if (v === '75%') return 'w-3/4';
                if (v === '33.333%' || v === '33.33%') return 'w-1/3';
                if (v === '66.667%' || v === '66.66%') return 'w-2/3';
                if (v === '20%') return 'w-1/5';
                if (v === '40%') return 'w-2/5';
                if (v === '60%') return 'w-3/5';
                if (v === '80%') return 'w-4/5';
                if (v === '16.667%' || v === '16.66%') return 'w-1/6';
                if (v === '83.333%' || v === '83.33%') return 'w-5/6';
                if (v === 'auto') return 'w-auto';
                return `w-[${v}]`;
            },
            height: (v) => {
                if (v === '100%') return 'h-full';
                if (v === '50%') return 'h-1/2';
                if (v === 'auto') return 'h-auto';
                return `h-[${v}]`;
            },
            flexGrow: (v) => {
                if (v === '1') return 'grow';
                if (v === '0') return 'grow-0';
                return v > 1 ? `grow-[${v}]` : 'grow';
            },
            flexShrink: (v) => {
                if (v === '1') return 'shrink';
                if (v === '0') return 'shrink-0';
                return `shrink-[${v}]`;
            },
            margin: (v) => {
                if (v === '0') return 'm-0';
                if (v === 'auto') return 'm-auto';
                return `m-[${v}]`;
            },
            padding: (v) => {
                if (v === '0') return 'p-0';
                return `p-[${v}]`;
            },
            flexWrap: { 'wrap':'flex-wrap', 'nowrap':'flex-nowrap', 'wrap-reverse':'flex-wrap-reverse' },
            alignSelf: { 'flex-start':'self-start', 'flex-end':'self-end', 'center':'self-center', 'stretch':'self-stretch' },
            paddingTop: (v) => v==='0'? 'pt-0': `pt-[${v}]`,
            paddingRight: (v) => v==='0'? 'pr-0': `pr-[${v}]`,
            paddingBottom: (v) => v==='0'? 'pb-0': `pb-[${v}]`,
            paddingLeft: (v) => v==='0'? 'pl-0': `pl-[${v}]`,
            marginTop: (v) => v==='0'? 'mt-0': (v==='auto'?'mt-auto': `mt-[${v}]`),
            marginRight: (v) => v==='0'? 'mr-0': (v==='auto'?'mr-auto': `mr-[${v}]`),
            marginBottom: (v) => v==='0'? 'mb-0': (v==='auto'?'mb-auto': `mb-[${v}]`),
            marginLeft: (v) => v==='0'? 'ml-0': (v==='auto'?'ml-auto': `ml-[${v}]`),
        };
        
        const m = mapping[prop];
        if (!m) return '';
        if (typeof m === 'function') return m(value);
        return m[value] || '';
    }

    cleanupForExport(element) {
        element.querySelectorAll('*').forEach(el => {
            el.classList.remove('selected');
                if (el.classList.contains('row')) el.classList.remove('row');
                if (el.classList.contains('col')) el.classList.remove('col');
                if (el.classList.contains('grid-container')) el.classList.remove('grid-container');
                if (el.classList.contains('grid-item')) el.classList.remove('grid-item');
                if (el.classList.length === 0) el.removeAttribute('class');
            el.removeAttribute('style');
            
            // Clean up visibility flags from styles and dataset
            if (el.dataset.styles) {
                try {
                    const styles = JSON.parse(el.dataset.styles);
                    delete styles.desktop?.__hidden;
                    delete styles.tablet?.__hidden;
                    delete styles.mobile?.__hidden;
                    el.dataset.styles = JSON.stringify(styles);
                } catch {}
            }
            delete el.dataset.hideDesktop;
            delete el.dataset.hideTablet;
            delete el.dataset.hideMobile;

            el.removeAttribute('data-styles');
                el.removeAttribute('data-responsive-stack');
            el.removeAttribute('contenteditable');
            el.removeAttribute('data-user-class');
            el.removeAttribute('data-user-tag');
            el.removeAttribute('data-grid-stack');
            // Preserve export-split marker for later script injection
            if (el.dataset.exportSplit === 'true') el.setAttribute('data-export-split','true');
            if (el.textContent.trim() === 'Row' || el.textContent.trim() === 'Col') {
                el.textContent = '';
            }
        });
    }

    applySemanticTransform(root) {
        root.querySelectorAll('[data-user-tag], [data-user-class]').forEach(el => {
            const tag = el.getAttribute('data-user-tag');
            const cls = el.getAttribute('data-user-class');
            if (tag && tag.toLowerCase() !== 'div') {
                const replacement = document.createElement(tag);
                while (el.firstChild) replacement.appendChild(el.firstChild);
                if (cls) replacement.className = cls; else if (el.className) replacement.className = el.className;
                el.parentNode.replaceChild(replacement, el);
            } else if (cls) {
                if (!el.className) el.className = cls; else el.classList.add(cls);
            }
        });
    }

    extractInnerContent(element) {
        // Return just the inner HTML without the preview wrapper div
        return element.innerHTML;
    }

    formatHTML(html, { compact = false } = {}) {
        try {
            if (compact) {
                return html.replace(/>\s+</g,'><').trim();
            }
            const linesRaw = html
                .replace(/>\s*</g, '><') // collapse internal whitespace between tags first
                .replace(/></g, '>\n<')
                .split(/\n/)
                .map(l=>l.trim())
                .filter(Boolean);

            const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
            const out = [];
            let level = 0;
            for (const line of linesRaw) {
                const isClosing = /^<\//.test(line);
                if (isClosing) level = Math.max(level - 1, 0);
                out.push('  '.repeat(level) + line);
                const openTagMatch = line.match(/^<([a-zA-Z0-9-]+)/);
                const selfClose = /\/>$/.test(line) || isClosing;
                const tag = openTagMatch ? openTagMatch[1].toLowerCase() : '';
                if (!selfClose && tag && !voidTags.has(tag)) level++;
            }
            // Normalize any common leading indentation (should already start at 0, but just in case)
            const leadingSpaces = out
                .filter(l=>l.trim())
                .map(l=>l.match(/^(\s*)/)[1].length)
                .reduce((a,b)=>Math.min(a,b), Infinity);
            if (leadingSpaces > 0 && leadingSpaces !== Infinity) {
                return out.map(l=>l.slice(leadingSpaces)).join('\n');
            }
            return out.join('\n');
        } catch(e) { return html; }
    }

    // Reintroduced: generate pure CSS with mobile-first media queries
    generateCSS(root){
        const desktopRules=[]; const tabletRules=[]; const mobileRules=[];
        let counter=0;
        const elements=[root, ...root.querySelectorAll('*')];
        elements.forEach(el=>{
            if(!el.dataset || !el.dataset.styles) return;
            let styles; try { styles=JSON.parse(el.dataset.styles); } catch { return; }
            const cls = el.getAttribute('data-user-class') || ('el-'+(++counter));
            if(!el.classList.contains(cls)) el.classList.add(cls);
            const sel = '.'+cls;
            
            // Handle visibility first
            if (styles.desktop?.__hidden) styles.desktop.display = 'none';
            if (styles.tablet?.__hidden) styles.tablet.display = 'none';
            if (styles.mobile?.__hidden) styles.mobile.display = 'none';

            const desk=styles.desktop||{}; const tab=styles.tablet||{}; const mob=styles.mobile||{};
            const deskCss=this.formatCSS(desk,'  ');
            if(deskCss.trim()) desktopRules.push(`${sel} {\n${deskCss}}`);
            const tabCss=this.formatCSS(tab,'  ');
            if(tabCss.trim()) tabletRules.push(`${sel} {\n${tabCss}}`);
            const mobCss=this.formatCSS(mob,'  ');
            if(mobCss.trim()) mobileRules.push(`${sel} {\n${mobCss}}`);
        });
        // Media queries: assume breakpoints (tablet >= 768px, desktop >= 1024px) consistent with UI
        let css='';
        if(mobileRules.length) css+=`/* Mobile */\n${mobileRules.join('\n\n')}\n\n`;
        if(tabletRules.length) css+=`@media (min-width: 768px) {\n${tabletRules.join('\n\n')}\n}\n\n`;
        if(desktopRules.length) css+=`@media (min-width: 1024px) {\n${desktopRules.join('\n\n')}\n}\n`;
        return css.trim();
    }

    generateCode() {
        if (this._generating) return; // guard re-entry
        this._generating = true;
        try {
            const format = this.app.querySelector('#code-format-select').value;
            const doMinify = this.prefs.minify || !!this.app.querySelector('#minify-export')?.checked;
            const previewClone = this.preview.cloneNode(true);
            if (format === 'tailwind') {
                this.generateTailwind(previewClone);
                const visibilityNotes = this.buildVisibilityNotes(previewClone, 'tailwind');
                this.cleanupForExport(previewClone);
                this.applySemanticTransform(previewClone);
                this.prepareExportSplits(previewClone);
                const rawHtml = this.extractInnerContent(previewClone);
                const htmlContent = doMinify ? this.formatHTML(rawHtml,{compact:true}) : this.formatHTML(rawHtml);
                this.app.querySelector('#html-code').textContent = htmlContent;
                this.app.querySelector('#css-code').textContent = '/* Tailwind CSS classes are applied directly in the HTML. */' + (visibilityNotes ? `\n\n/* Visibility Notes:\n${visibilityNotes}\n*/` : '');
            } else {
                const cssRules = this.generateCSS(previewClone);
                const visibilityNotes = this.buildVisibilityNotes(previewClone, 'css');
                this.cleanupForExport(previewClone);
                this.applySemanticTransform(previewClone);
                this.prepareExportSplits(previewClone);
                const rawHtml = this.extractInnerContent(previewClone);
                const htmlContent = doMinify ? this.formatHTML(rawHtml,{compact:true}) : this.formatHTML(rawHtml);
                const finalCSS = doMinify ? this.minifyCSS(cssRules) : cssRules;
                this.app.querySelector('#html-code').textContent = htmlContent;
                this.app.querySelector('#css-code').textContent = finalCSS + (visibilityNotes ? `\n/* Visibility Notes:\n${visibilityNotes}\n*/\n` : '');
            }
            if (this.codeModalOpen) this.syncModalCode();
            this.generatedOnce = true;
        } catch(err){
            console.error('generateCode failed', err);
            // Clear generating flag so user can retry
        } finally {
            this._generating = false;
        }
        }

    formatCSS(styles, indent = '  ') {
        let css = '';
        for(const prop in styles) {
            css += `${indent}${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${styles[prop]};
`;
        }
        return css;
    }

    openCodeModal() {
        if (!this.generatedOnce) this.generateCode();
        this.codeModalOpen = true;
        document.getElementById('code-modal-overlay').style.display = 'flex';
        this.syncModalCode();
        this.installModalEvents();
    }

    closeCodeModal() {
        this.codeModalOpen = false;
        document.getElementById('code-modal-overlay').style.display = 'none';
    }

    syncModalCode() {
        const html = this.app.querySelector('#html-code').textContent;
        const css = this.app.querySelector('#css-code').textContent;
        this.app.querySelector('#modal-html-pre').textContent = html || '// (No HTML yet)';
        this.app.querySelector('#modal-css-pre').textContent = css || '/* (No CSS yet) */';
    }

    installModalEvents() {
        if (this.modalEventsInstalled) return;
        this.modalEventsInstalled = true;
        this.app.querySelector('#close-code-modal').addEventListener('click', () => this.closeCodeModal());
        this.app.querySelectorAll('.code-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.querySelectorAll('.code-tab').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.target;
                this.app.querySelectorAll('#code-modal .code-pane').forEach(pane => {
                    pane.style.display = pane.id === target ? 'block' : 'none';
                });
            });
        });
        this.app.querySelector('#copy-current-btn').addEventListener('click', () => {
            const activePane = this.app.querySelector('#code-modal .code-pane:not([style*="display: none"]) pre');
            this.copyText(activePane.textContent);
        });
        this.app.querySelector('#copy-all-btn').addEventListener('click', () => {
            const html = this.app.querySelector('#modal-html-pre').textContent;
            const css = this.app.querySelector('#modal-css-pre').textContent;
            this.copyText(`HTML:\n${html}\n\nCSS:\n${css}`);
        });
        this.app.querySelector('#download-zip-btn').addEventListener('click', () => {
            this.downloadFiles();
        });
        // Escape key support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.codeModalOpen) this.closeCodeModal();
        });
    }

    copyText(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(()=>{});
        } else {
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch(e) {}
            ta.remove();
        }
    }

    downloadFiles() {
        const html = this.app.querySelector('#html-code').textContent || '';
        const css = this.app.querySelector('#css-code').textContent || '';
        const zipParts = [
            { name: 'index.html', content: html.startsWith('<') ? html : `<!-- Generated HTML -->\n${html}` },
            { name: 'styles.css', content: css.startsWith('/*') ? css : `/* Generated CSS */\n${css}` }
        ];
        // Simple multi-file download fallback (no JSZip dependency): create a .txt bundle
        const blob = new Blob(zipParts.map(p=>`===== ${p.name} =====\n${p.content}\n\n`).join('\n'), { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'layout-code.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 2000);
    }

    updatePropertiesPanel() {
        const panelContent = this.app.querySelector('#properties-panel-content');
        if (!this.selectedElement) {
            panelContent.innerHTML = '<p>Select an element to edit its properties.</p>';
            this.updateDeviceOverrideIndicators(null);
            this.updateBreadcrumb(null);
            return;
        }

    const multiMode = this.multiSelected && this.multiSelected.size > 1;
    const selectionArray = multiMode ? Array.from(this.multiSelected) : [this.selectedElement];
    const allAreFlexChildren = multiMode ? selectionArray.every(el => !el.classList.contains('row') && !el.classList.contains('grid-container')) : false;
    const allAreRows = multiMode ? selectionArray.every(el => el.classList.contains('row')) : false;
    const allAreGridItems = multiMode ? selectionArray.every(el => el.classList.contains('grid-item')) : false;

        if (!this.selectedElement.dataset.styles) {
            this.selectedElement.dataset.styles = JSON.stringify({
                desktop: {},
                tablet: {},
                mobile: {}
            });
        }

    const styles = JSON.parse(this.selectedElement.dataset.styles);
        const editDevice = this.propertyEditDevice || 'desktop';
        const currentStyles = styles[editDevice];

        // Helper to compute unified value across selection for a given style property
        const unifiedValue = (prop) => {
            if (!multiMode) return currentStyles[prop] || '';
            let first; let same = true;
            for (const el of selectionArray) {
                let s; try { s = JSON.parse(el.dataset.styles || '{}'); } catch { s = { desktop:{}, tablet:{}, mobile:{} }; }
                const dev = s[editDevice] || {};
                if (first === undefined) first = dev[prop]; else if (dev[prop] !== first) { same = false; break; }
            }
            return same ? (first || '') : '';
        };
        const isRow = this.selectedElement.classList.contains('row');
    const isGridContainer = this.selectedElement.classList.contains('grid-container');
    const isGridItem = this.selectedElement.classList.contains('grid-item');
        // Cleanup legacy placeholder text inside grid containers
        if (isGridContainer) {
            Array.from(this.selectedElement.childNodes).forEach(n => {
                if (n.nodeType === Node.TEXT_NODE && n.textContent.trim().toLowerCase() === 'grid') n.remove();
            });
        }

        // If a column is selected, find its row parent (if any) for responsive stack context
        let parentRow = null;
        if (!isRow) {
            parentRow = this.selectedElement.closest('.row');
        }

        // Responsive stack UI snippet
        const responsiveStackUI = isRow ? `
            <div class="property">
                <label style="display:flex; gap:6px; align-items:center;">
                    <input type="checkbox" id="responsive-stack" ${this.selectedElement.dataset.responsiveStack === 'true' ? 'checked' : ''}>
                    <span>Stack (vertical) on tablet & mobile</span>
                </label>
                <small style="color:#666;">When enabled, flex-direction switches to column at <=768px.</small>
            </div>` : parentRow ? `
            <div class="property">
                <label style="display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.8rem; color:#555;">Parent row stacking on mobile: <strong>${parentRow.dataset.responsiveStack === 'true' ? 'Enabled' : 'Disabled'}</strong></span>
                    <button id="jump-to-row" style="align-self:flex-start; background:#007bff; color:#fff; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.7rem;">Edit Row Container</button>
                </label>
            </div>` : '';

        const visibilityDesktopHidden = styles.desktop.display === 'none';
        const visibilityTabletHidden = styles.tablet.display === 'none';
        const visibilityMobileHidden = styles.mobile.display === 'none';

    panelContent.setAttribute('data-panel-kind', isRow? 'row' : (isGridContainer? 'grid-container' : (isGridItem? 'grid-item' : 'other')));
        const userClass = this.selectedElement.getAttribute('data-user-class') || '';
        const userTag = this.selectedElement.getAttribute('data-user-tag') || 'div';
        const isLeaf = this.selectedElement.children.length === 0;
        const leafText = isLeaf ? this.selectedElement.textContent.trim() : '';
        if (multiMode) {
            panelContent.innerHTML = `
            <div class="property"><strong style="font-size:0.75rem;">Multi-Select (${selectionArray.length} elements)</strong><br><small style="color:#666;">Editing applies to all selected. Blank fields with mixed values show as empty.</small></div>
            <div class="property" style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" id="bulk-duplicate" style="flex:1 1 48%; background:#0d6efd; color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;">Duplicate</button>
                <button type="button" id="bulk-delete" style="flex:1 1 48%; background:#dc3545; color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;">Delete</button>
                <button type="button" id="bulk-wrap-row" style="flex:1 1 48%; background:#6610f2; color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;">Wrap in Row</button>
                <button type="button" id="bulk-wrap-grid" style="flex:1 1 48%; background:#6f42c1; color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;">Wrap in Grid</button>
                <button type="button" id="bulk-copy-styles" style="flex:1 1 48%; background:#198754; color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;">Copy Styles</button>
                <button type="button" id="bulk-paste-styles" style="flex:1 1 48%; background:#20c997; color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;" ${this.copiedStyles? '':'disabled style="opacity:.5;"'}>Paste Styles</button>
            </div>
            <div class="property">
                <label>Width</label>
                <div class="input-group wrap">
                    <input type="text" id="width-input" value="${unifiedValue('width')}" placeholder="${unifiedValue('width')?'':'(mixed)'}">
                    <select id="width-unit">
                        <option value="px">px</option>
                        <option value="%">%</option>
                        <option value="em">em</option>
                        <option value="rem">rem</option>
                        <option value="svw">svw</option>
                        <option value="dvw">dvw</option>
                        <option value="lvw">lvw</option>
                        <option value="vw">vw</option>
                    </select>
                </div>
            </div>
            <div class="property">
                <label>Height</label>
                <div class="input-group wrap">
                    <input type="text" id="height-input" value="${unifiedValue('height')}" placeholder="${unifiedValue('height')?'':'(mixed)'}">
                    <select id="height-unit">
                        <option value="px">px</option>
                        <option value="%">%</option>
                        <option value="em">em</option>
                        <option value="rem">rem</option>
                        <option value="svh">svh</option>
                        <option value="dvh">dvh</option>
                        <option value="lvh">lvh</option>
                        <option value="vh">vh</option>
                    </select>
                </div>
            </div>
            <div class="property">
                <label>Spacing</label>
                <div class="spacing-grid">
                    <div>
                        <label>Padding</label>
                        <select id="padding-select" data-unified="${unifiedValue('padding')}">
                            <option value="">${unifiedValue('padding')? 'None' : '(mixed)'}</option>
                            <option value="8px">8px</option>
                            <option value="16px">16px</option>
                            <option value="24px">24px</option>
                            <option value="32px">32px</option>
                            <option value="1rem">1rem</option>
                            <option value="2rem">2rem</option>
                        </select>
                    </div>
                    <div>
                        <label>Margin</label>
                        <select id="margin-select" data-unified="${unifiedValue('margin')}">
                            <option value="">${unifiedValue('margin')? 'None' : '(mixed)'}</option>
                            <option value="8px">8px</option>
                            <option value="16px">16px</option>
                            <option value="24px">24px</option>
                            <option value="32px">32px</option>
                            <option value="1rem">1rem</option>
                            <option value="2rem">2rem</option>
                        </select>
                    </div>
                </div>
                <div class="adv-spacing-head"><button type="button" id="adv-spacing-toggle" class="adv-toggle" title="Show per-side padding & margin">Advanced per-side</button></div>
                <div id="adv-spacing-panel" style="display:none; margin-top:6px;">
                    <div class="adv-group">
                        <label class="adv-label">Padding (per-side)</label>
                        <div class="adv-grid">
                            <input id="pad-top-input" placeholder="Top" value="${unifiedValue('paddingTop')}" />
                            <input id="pad-right-input" placeholder="Right" value="${unifiedValue('paddingRight')}" />
                            <input id="pad-bottom-input" placeholder="Bottom" value="${unifiedValue('paddingBottom')}" />
                            <input id="pad-left-input" placeholder="Left" value="${unifiedValue('paddingLeft')}" />
                        </div>
                    </div>
                    <div class="adv-group" style="margin-top:6px;">
                        <label class="adv-label">Margin (per-side)</label>
                        <div class="adv-grid">
                            <input id="mar-top-input" placeholder="Top" value="${unifiedValue('marginTop')}" />
                            <input id="mar-right-input" placeholder="Right" value="${unifiedValue('marginRight')}" />
                            <input id="mar-bottom-input" placeholder="Bottom" value="${unifiedValue('marginBottom')}" />
                            <input id="mar-left-input" placeholder="Left" value="${unifiedValue('marginLeft')}" />
                        </div>
                    </div>
                </div>
            </div>
            <div class="property">
                <label>Colors</label>
                <div class="input-group" style="flex-wrap:wrap;">
                    <label style="flex:1 1 48%; font-size:0.65rem; display:flex; gap:4px; align-items:center;">BG <input type="color" id="bg-color-input" value="${unifiedValue('backgroundColor') || '#ffffff'}" style="flex:1 1 auto; height:28px;"></label>
                    <label style="flex:1 1 48%; font-size:0.65rem; display:flex; gap:4px; align-items:center;">Text <input type="color" id="text-color-input" value="${unifiedValue('color') || '#000000'}" style="flex:1 1 auto; height:28px;"></label>
                </div>
            </div>
            ${allAreFlexChildren ? `<div class="property"><label>Flex Grow</label><select id="flex-grow-select"><option value="">Auto</option><option value="0">No grow</option><option value="1">Grow to fill</option></select></div>` : ''}
            ${allAreFlexChildren ? `<div class="property"><label>Align Self</label><select id="align-self-select"><option value="">Auto</option><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option><option value="stretch">Stretch</option></select></div>` : ''}
            ${allAreRows ? `<div class="property"><label>Flex Gap</label><input type="text" id="flex-gap-input" value="${unifiedValue('gap')}" placeholder="${unifiedValue('gap')?'':'(mixed)'}"></div>`: ''}
            ${allAreRows ? `<div class="property"><label>Flex Wrap</label><select id="flex-wrap-select"><option value="nowrap">No Wrap</option><option value="wrap">Wrap</option><option value="wrap-reverse">Wrap Reverse</option></select></div>`: ''}
            `;
        } else {
    panelContent.innerHTML = `
            ${responsiveStackUI}
            <div class="property">
                <label>Semantic & Content <span class="help-icon">?<span class="tooltip-text">Set an optional semantic HTML5 tag and custom export class. Text editing only for leaf elements.</span></span></label>
                <div class="input-group wrap">
                    <select id="semantic-tag">${['div','header','main','section','article','aside','footer'].map(t=>`<option value="${t}" ${userTag===t?'selected':''}>${t}</option>`).join('')}</select>
                    <input type="text" id="semantic-class" placeholder="custom-class" value="${userClass}" style="flex:1 1 auto;" />
                </div>
                ${isLeaf ? `<input type="text" id="text-content-input" placeholder="Text content" value="${leafText.replace(/"/g,'&quot;')}" style="margin-top:6px;">` : ''}
                <div class="input-group" style="margin-top:6px;">
                    <label style="flex:1 1 50%; font-size:0.65rem; display:flex; gap:4px; align-items:center;">BG <input type="color" id="bg-color-input" value="${currentStyles.backgroundColor || '#ffffff'}" style="flex:1 1 auto; height:28px;"></label>
                    <label style="flex:1 1 50%; font-size:0.65rem; display:flex; gap:4px; align-items:center;">Text <input type="color" id="text-color-input" value="${currentStyles.color || '#000000'}" style="flex:1 1 auto; height:28px;"></label>
                </div>
            </div>
            <div class="property">
                <label>Width <span class="help-icon">?
                    <span class="tooltip-text">Width units:<br><strong>px</strong>: fixed pixels<br><strong>%</strong>: percent of parent<br><strong>em/rem</strong>: relative (rem = root)<br><strong>vw</strong>: legacy viewport width<br><strong>svw</strong>: small viewport width (stable, iOS safe)<br><strong>lvw</strong>: large viewport width<br><strong>dvw</strong>: dynamic viewport width</span>
                </span></label>
                <div class="input-group wrap">
                    <input type="text" id="width-input" value="${currentStyles.width || ''}" placeholder="auto">
                    <select id="width-unit">
                        <option value="px">px</option>
                        <option value="%">%</option>
                        <option value="em">em</option>
                        <option value="rem">rem</option>
                        <option value="svw">svw</option>
                        <option value="dvw">dvw</option>
                        <option value="lvw">lvw</option>
                        <option value="vw">vw</option>
                    </select>
                </div>
                <div class="quick-values">
                    <button class="quick-btn" data-value="25%">25%</button>
                    <button class="quick-btn" data-value="50%">50%</button>
                    <button class="quick-btn" data-value="100%">100%</button>
                    <button class="quick-btn" data-value="auto">auto</button>
                </div>
            </div>
            <div class="property">
                <label>Height <span class="help-icon">?<span class="tooltip-text">Height units similar to width. svh/dvh handle mobile browser UI resizing more predictably.</span></span></label>
                <div class="input-group wrap">
                    <input type="text" id="height-input" value="${currentStyles.height || ''}" placeholder="auto">
                    <select id="height-unit">
                        <option value="px">px</option>
                        <option value="%">%</option>
                        <option value="em">em</option>
                        <option value="rem">rem</option>
                        <option value="svh">svh</option>
                        <option value="dvh">dvh</option>
                        <option value="lvh">lvh</option>
                        <option value="vh">vh</option>
                    </select>
                </div>
                <div class="quick-values">
                    <button class="quick-btn" data-value="100px">100px</button>
                    <button class="quick-btn" data-value="50vh">50vh</button>
                    <button class="quick-btn" data-value="100vh">100vh</button>
                    <button class="quick-btn" data-value="auto">auto</button>
                </div>
            </div>
            <div class="property">
                <label>Spacing <span class="help-icon">?<span class="tooltip-text">Padding = inner space; Margin = outer space. Adjust separately.</span></span></label>
                <div class="spacing-grid">
                    <div>
                        <label>Padding <span class="help-icon">?<span class="tooltip-text">Apply uniform padding. For custom per-side values you'll extend later.</span></span></label>
                        <select id="padding-select">
                            <option value="">None</option>
                            <option value="8px">8px</option>
                            <option value="16px">16px</option>
                            <option value="24px">24px</option>
                            <option value="32px">32px</option>
                            <option value="1rem">1rem</option>
                            <option value="2rem">2rem</option>
                        </select>
                    </div>
                    <div>
                        <label>Margin <span class="help-icon">?<span class="tooltip-text">Space outside the element. Useful for gaps between siblings.</span></span></label>
                        <select id="margin-select">
                            <option value="">None</option>
                            <option value="8px">8px</option>
                            <option value="16px">16px</option>
                            <option value="24px">24px</option>
                            <option value="32px">32px</option>
                            <option value="1rem">1rem</option>
                            <option value="2rem">2rem</option>
                        </select>
                    </div>
                </div>
                <div class="adv-spacing-head"><button type="button" id="adv-spacing-toggle" class="adv-toggle" title="Show per-side padding & margin">Advanced per-side</button></div>
                <div id="adv-spacing-panel" style="display:none; margin-top:6px;">
                    <div class="adv-group">
                        <label class="adv-label">Padding (per-side)</label>
                        <div class="adv-grid">
                            <input id="pad-top-input" placeholder="Top" value="${unifiedValue('paddingTop')}" />
                            <input id="pad-right-input" placeholder="Right" value="${unifiedValue('paddingRight')}" />
                            <input id="pad-bottom-input" placeholder="Bottom" value="${unifiedValue('paddingBottom')}" />
                            <input id="pad-left-input" placeholder="Left" value="${unifiedValue('paddingLeft')}" />
                        </div>
                    </div>
                    <div class="adv-group" style="margin-top:6px;">
                        <label class="adv-label">Margin (per-side)</label>
                        <div class="adv-grid">
                            <input id="mar-top-input" placeholder="Top" value="${unifiedValue('marginTop')}" />
                            <input id="mar-right-input" placeholder="Right" value="${unifiedValue('marginRight')}" />
                            <input id="mar-bottom-input" placeholder="Bottom" value="${unifiedValue('marginBottom')}" />
                            <input id="mar-left-input" placeholder="Left" value="${unifiedValue('marginLeft')}" />
                        </div>
                    </div>
                </div>
            </div>
            <div class="property">
                <label>Colors</label>
                <div class="input-group" style="flex-wrap:wrap;">
                    <label style="flex:1 1 48%; font-size:0.65rem; display:flex; gap:4px; align-items:center;">BG <input type="color" id="bg-color-input" value="${currentStyles.backgroundColor || '#ffffff'}" style="flex:1 1 auto; height:28px;"></label>
                    <label style="flex:1 1 48%; font-size:0.65rem; display:flex; gap:4px; align-items:center;">Text <input type="color" id="text-color-input" value="${currentStyles.color || '#000000'}" style="flex:1 1 auto; height:28px;"></label>
                </div>
            </div>
            <div class="property">
                <label>Visibility <span class="help-icon">?<span class="tooltip-text">Hide this element on specific breakpoints. Generates display:none for those sizes (or hidden class in Tailwind). Toggle at runtime by adding/removing display:none.</span></span></label>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:4px; font-size:0.7rem;">
                    <label style="display:flex; gap:4px; align-items:center;">
                        <input type="checkbox" id="hide-desktop" ${visibilityDesktopHidden ? 'checked' : ''}> Desktop
                    </label>
                    <label style="display:flex; gap:4px; align-items:center;">
                        <input type="checkbox" id="hide-tablet" ${visibilityTabletHidden ? 'checked' : ''}> Tablet
                    </label>
                    <label style="display:flex; gap:4px; align-items:center;">
                        <input type="checkbox" id="hide-mobile" ${visibilityMobileHidden ? 'checked' : ''}> Mobile
                    </label>
                </div>
            </div>
                        ${isRow ? `
                            <div class="property">
                                <label>Layout Direction <span class="help-icon">?<span class="tooltip-text">Row = horizontal; Column = vertical.</span></span></label>
                                <select id="flex-direction-select"><option value="row">Horizontal (Row)</option><option value="column">Vertical (Column)</option></select>
                            </div>
                            <div class="property">
                                <label>Alignment <span class="help-icon">?<span class="tooltip-text">Justify = main axis; Align = cross axis.</span></span></label>
                                <div class="alignment-grid">
                                    <div><label>Justify</label><select id="justify-content-select"><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option><option value="space-between">Space Between</option><option value="space-around">Space Around</option></select></div>
                                    <div><label>Align</label><select id="align-items-select"><option value="stretch">Stretch</option><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option></select></div>
                                </div>
                            </div>
                        ` : isGridContainer ? `
                            <div class="property">
                                <label>Grid Columns <span class="help-icon">?<span class="tooltip-text">Adjust count of equal 1fr columns. Use presets.</span></span></label>
                                <div class="input-group">
                                    <input type="number" min="1" id="grid-col-count" value="${(styles.desktop.gridTemplateColumns||'').split(' ').filter(Boolean).length || 2}" style="width:70px;">
                                    <button class="quick-btn" data-gridcols="2">2</button>
                                    <button class="quick-btn" data-gridcols="3">3</button>
                                    <button class="quick-btn" data-gridcols="4">4</button>
                                    <button class="quick-btn" data-gridcols="6">6</button>
                                </div>
                            </div>
                            <div class="property">
                                <label>Grid Settings <span class="help-icon">?<span class="tooltip-text">Gap + alignment + mobile stacking.</span></span></label>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    <div class="input-group">
                                        <input type="text" id="grid-gap-input" value="${styles.desktop.gap || '16px'}" placeholder="gap">
                                        <select id="grid-gap-preset">
                                            <option value="">Custom</option><option value="4px">4px</option><option value="8px">8px</option><option value="12px">12px</option><option value="16px">16px</option><option value="24px">24px</option><option value="32px">32px</option>
                                        </select>
                                    </div>
                                                        <div class="input-group">
                                        <select id="justify-items-select"><option value="">Justify Items</option><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option></select>
                                        <select id="align-items-grid-select"><option value="">Align Items</option><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option></select>
                                    </div>
                                                        <div class="input-group" style="margin-top:4px;">
                                                            <input type="number" min="1" id="grid-tablet-cols" placeholder="Tablet cols" style="width:90px;">
                                                            <input type="number" min="1" id="grid-mobile-cols" placeholder="Mobile cols" style="width:90px;">
                                                        </div>
                                                        <small class="helper-note">Tablet/Mobile columns override desktop. Set Mobile=1 for stacked; leave blank to inherit.</small>
                                    <label style="display:flex; gap:6px; align-items:center; font-size:0.75rem;"><input type="checkbox" id="grid-stack-toggle" ${this.selectedElement.dataset.gridStack === 'true' ? 'checked' : ''}> <span>Stack to 1 col (tablet & mobile)</span></label>
                                                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                                            <button id="add-grid-item-btn" style="background:#0d6efd;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:0.70rem;">Add Cell</button>
                                                            <button id="add-grid-row-btn" style="background:#6f42c1;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:0.70rem;">Add Row (duplicates last)</button>
                                                        </div>
                                                        <small class="helper-note">Tip: Adjust column count for structure. Use spans on items for merging (e.g. set Cols=4 then give a cell Col span=2). Add Row clones pattern; spans can cross rows.</small>
                                </div>
                            </div>
                        ` : isGridItem ? `
                            <div class="property">
                                <label>Grid Item Span <span class="help-icon">?<span class="tooltip-text">Set how many columns/rows this cell spans.</span></span></label>
                                <div class="input-group">
                                    <input type="number" min="1" id="grid-col-span" placeholder="Cols" style="width:70px;">
                                    <input type="number" min="1" id="grid-row-span" placeholder="Rows" style="width:70px;">
                                </div>
                                <button id="clear-span-btn" style="margin-top:6px; background:#6c757d;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.7rem;">Clear Span</button>
                            </div>
                        ` : `
                            <div class="property">
                                <label>Flex Grow <span class="help-icon">?<span class="tooltip-text">Grow=1 lets the element expand to fill extra space; 0 keeps intrinsic width.</span></span></label>
                                <select id="flex-grow-select"><option value="">Auto</option><option value="0">No grow</option><option value="1">Grow to fill</option></select>
                            </div>
                            <div class="property">
                                <label>Align Self <span class="help-icon">?<span class="tooltip-text">Override this element's alignment inside its flex/grid parent.</span></span></label>
                                <select id="align-self-select"><option value="">Auto</option><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option><option value="stretch">Stretch</option></select>
                            </div>
                        `}
            ${isRow ? `<div class="property"><label>Flex Gap <span class="help-icon">?<span class="tooltip-text">Space between flex children (modern gap support).</span></span></label><input type="text" id="flex-gap-input" value="${currentStyles.gap||''}" placeholder="e.g. 12px"></div>`:''}
            ${isRow ? `<div class="property"><label>Flex Wrap <span class="help-icon">?<span class="tooltip-text">Control wrapping of flex children.</span></span></label><select id="flex-wrap-select"><option value="nowrap">No Wrap</option><option value="wrap">Wrap</option><option value="wrap-reverse">Wrap Reverse</option></select></div>`:''}
        `;
        }

        // Setup event listeners
        if (isRow) {
            this.setupResponsiveToggle(this.selectedElement);
        } else if (parentRow) {
            const jumpBtn = this.app.querySelector('#jump-to-row');
            if (jumpBtn) {
                jumpBtn.addEventListener('click', () => {
                    if (this.selectedElement) this.selectedElement.classList.remove('selected');
                    this.selectedElement = parentRow;
                    parentRow.classList.add('selected');
                    this.updatePropertiesPanel();
                });
            }
        }
        this.setupQuickValues();
        if (multiMode) {
            this.setupBulkPropertyInput('width-input', 'width', editDevice);
            this.setupBulkPropertyInput('height-input', 'height', editDevice);
            this.setupBulkPropertyInput('padding-select', 'padding', editDevice, 'select');
            this.setupBulkPropertyInput('margin-select', 'margin', editDevice, 'select');
        } else {
            this.setupPropertyInput('width-input', 'width', styles, editDevice);
            this.setupPropertyInput('height-input', 'height', styles, editDevice);
            this.setupPropertyInput('padding-select', 'padding', styles, editDevice, 'select');
            this.setupPropertyInput('margin-select', 'margin', styles, editDevice, 'select');
        }
        // Advanced spacing toggle & inputs
        const advToggle = this.app.querySelector('#adv-spacing-toggle');
        const advPanel = this.app.querySelector('#adv-spacing-panel');
        if (advToggle && advPanel) {
            advToggle.addEventListener('click', () => {
                const open = advPanel.style.display !== 'none';
                advPanel.style.display = open ? 'none' : 'block';
                advToggle.classList.toggle('open', !open);
            }, { once: true });
            // One-time init values for per-side
            ['Top','Right','Bottom','Left'].forEach(side => {
                const padInput = this.app.querySelector(`#pad-${side.toLowerCase()}-input`);
                const marInput = this.app.querySelector(`#mar-${side.toLowerCase()}-input`);
                const stylePadKey = 'padding'+side;
                const styleMarKey = 'margin'+side;
                if (padInput) {
                    padInput.value = currentStyles[stylePadKey] || '';
                    padInput.addEventListener('input', e => { if (e.target.value) styles[editDevice][stylePadKey] = e.target.value; else delete styles[editDevice][stylePadKey]; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); this.scheduleHistoryCapture('prop:'+stylePadKey); this.scheduleAutoGenerate(); });
                }
                if (marInput) {
                    marInput.value = currentStyles[styleMarKey] || '';
                    marInput.addEventListener('input', e => { if (e.target.value) styles[editDevice][styleMarKey] = e.target.value; else delete styles[editDevice][styleMarKey]; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); this.scheduleHistoryCapture('prop:'+styleMarKey); this.scheduleAutoGenerate(); });
                }
            });
        }
        
    if (!multiMode && isRow) {
            this.setupPropertyInput('flex-direction-select', 'flexDirection', styles, editDevice, 'select');
            this.setupPropertyInput('justify-content-select', 'justifyContent', styles, editDevice, 'select');
            this.setupPropertyInput('align-items-select', 'alignItems', styles, editDevice, 'select');
        } else if (isGridContainer) {
            const colCountInput = this.app.querySelector('#grid-col-count');
            if (colCountInput) {
                colCountInput.addEventListener('input', e => {
                    const n = Math.max(1, parseInt(e.target.value||'1',10));
                    styles[editDevice].gridTemplateColumns = Array.from({length:n}).map(()=> '1fr').join(' ');
                    this.selectedElement.dataset.styles = JSON.stringify(styles);
                    this.applyStyles();
                    this.scheduleAutoGenerate();
                });
            }
            this.app.querySelectorAll('[data-gridcols]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const n = parseInt(btn.dataset.gridcols,10);
                    styles[editDevice].gridTemplateColumns = Array.from({length:n}).map(()=> '1fr').join(' ');
                    if (colCountInput) colCountInput.value = n;
                    this.selectedElement.dataset.styles = JSON.stringify(styles);
                    this.applyStyles();
                    this.scheduleAutoGenerate();
                });
            });
            const gapInput = this.app.querySelector('#grid-gap-input');
            const gapPreset = this.app.querySelector('#grid-gap-preset');
            const updateGap = (val) => {
                styles[editDevice].gap = val;
                this.selectedElement.dataset.styles = JSON.stringify(styles);
                this.applyStyles();
            };
            if (gapInput) gapInput.addEventListener('input', e => { updateGap(e.target.value); this.scheduleAutoGenerate(); });
            if (gapPreset) {
                gapPreset.value = styles[editDevice].gap || '';
                gapPreset.addEventListener('change', e => { if (e.target.value) { gapInput.value = e.target.value; updateGap(e.target.value); this.scheduleAutoGenerate(); }});
            }
            const justifyItemsSel = this.app.querySelector('#justify-items-select');
            if (justifyItemsSel) {
                justifyItemsSel.value = styles[editDevice].justifyItems || '';
                justifyItemsSel.addEventListener('change', e => { if (e.target.value) styles[editDevice].justifyItems = e.target.value; else delete styles[editDevice].justifyItems; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); this.scheduleAutoGenerate(); });
            }
            const alignItemsGridSel = this.app.querySelector('#align-items-grid-select');
            if (alignItemsGridSel) {
                alignItemsGridSel.value = styles[editDevice].alignItems || '';
                alignItemsGridSel.addEventListener('change', e => { if (e.target.value) styles[editDevice].alignItems = e.target.value; else delete styles[editDevice].alignItems; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); this.scheduleAutoGenerate(); });
            }
            const gridStackToggle = this.app.querySelector('#grid-stack-toggle');
            if (gridStackToggle) gridStackToggle.addEventListener('change', e => { this.selectedElement.dataset.gridStack = e.target.checked ? 'true':'false'; this.applyStyles(); });
            // Tablet/Mobile column overrides
            const tabletColsInput = this.app.querySelector('#grid-tablet-cols');
            const mobileColsInput = this.app.querySelector('#grid-mobile-cols');
            if (tabletColsInput) {
                if (styles.tablet.gridTemplateColumns) {
                    const tParts = styles.tablet.gridTemplateColumns.split(/\s+/).filter(Boolean);
                    if (tParts.every(p=>p==='1fr')) tabletColsInput.value = tParts.length;
                }
                tabletColsInput.addEventListener('input', e => {
                    const val = e.target.value;
                    if (val) {
                        const n = Math.max(1, parseInt(val,10));
                        styles.tablet.gridTemplateColumns = Array.from({length:n}).map(()=> '1fr').join(' ');
                    } else {
                        delete styles.tablet.gridTemplateColumns;
                    }
                    this.selectedElement.dataset.styles = JSON.stringify(styles);
                    this.applyStyles(); this.scheduleAutoGenerate();
                });
            }
            if (mobileColsInput) {
                if (styles.mobile.gridTemplateColumns) {
                    const mParts = styles.mobile.gridTemplateColumns.split(/\s+/).filter(Boolean);
                    if (mParts.every(p=>p==='1fr')) mobileColsInput.value = mParts.length;
                }
                mobileColsInput.addEventListener('input', e => {
                    const val = e.target.value;
                    if (val) {
                        const n = Math.max(1, parseInt(val,10));
                        styles.mobile.gridTemplateColumns = Array.from({length:n}).map(()=> '1fr').join(' ');
                    } else {
                        delete styles.mobile.gridTemplateColumns;
                    }
                    this.selectedElement.dataset.styles = JSON.stringify(styles);
                    this.applyStyles(); this.scheduleAutoGenerate();
                });
            }
            const addItemBtn = this.app.querySelector('#add-grid-item-btn');
            if (addItemBtn) addItemBtn.addEventListener('click', () => {
                const cell = document.createElement('div');
                cell.classList.add('grid-item');
                cell.textContent = `Cell ${this.selectedElement.children.length + 1}`;
                cell.dataset.styles = JSON.stringify({ desktop: {}, tablet: {}, mobile: {} });
                cell.dataset.responsiveStack = 'false';
                this.selectedElement.appendChild(cell);
                this.applyStyles(); this.scheduleAutoGenerate();
            });
            const addRowBtn = this.app.querySelector('#add-grid-row-btn');
            if (addRowBtn) addRowBtn.addEventListener('click', () => {
                const template = (styles.desktop.gridTemplateColumns || '1fr 1fr').split(/\s+/).filter(Boolean);
                const count = template.length;
                for (let i=0;i<count;i++) {
                    const cell = document.createElement('div');
                    cell.classList.add('grid-item');
                    cell.textContent = `Cell ${this.selectedElement.children.length + 1}`;
                    cell.dataset.styles = JSON.stringify({ desktop: {}, tablet: {}, mobile: {} });
                    cell.dataset.responsiveStack = 'false';
                    this.selectedElement.appendChild(cell);
                }
                this.applyStyles(); this.scheduleAutoGenerate();
            });
        } else if (isGridItem) {
            const colSpanInput = this.app.querySelector('#grid-col-span');
            const rowSpanInput = this.app.querySelector('#grid-row-span');
            const clearBtn = this.app.querySelector('#clear-span-btn');
            if (colSpanInput && rowSpanInput) {
                const applySpan = () => {
                    if (colSpanInput.value) styles[editDevice].gridColumn = `span ${parseInt(colSpanInput.value,10)} / span ${parseInt(colSpanInput.value,10)}`; else delete styles[editDevice].gridColumn;
                    if (rowSpanInput.value) styles[editDevice].gridRow = `span ${parseInt(rowSpanInput.value,10)} / span ${parseInt(rowSpanInput.value,10)}`; else delete styles[editDevice].gridRow;
                    this.selectedElement.dataset.styles = JSON.stringify(styles);
                    this.applyStyles();
                };
                colSpanInput.addEventListener('input', ()=>{ applySpan(); this.scheduleAutoGenerate(); });
                rowSpanInput.addEventListener('input', ()=>{ applySpan(); this.scheduleAutoGenerate(); });
                if (styles[editDevice].gridColumn) { const m = styles[editDevice].gridColumn.match(/span (\d+)/); if (m) colSpanInput.value = m[1]; }
                if (styles[editDevice].gridRow) { const m2 = styles[editDevice].gridRow.match(/span (\d+)/); if (m2) rowSpanInput.value = m2[1]; }
                if (clearBtn) clearBtn.addEventListener('click', () => { delete styles[editDevice].gridColumn; delete styles[editDevice].gridRow; colSpanInput.value=''; rowSpanInput.value=''; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); });
            }
        } else if (!multiMode) {
            this.setupPropertyInput('flex-grow-select', 'flexGrow', styles, editDevice, 'select');
            this.setupPropertyInput('align-self-select', 'alignSelf', styles, editDevice, 'select');
        }
        if (!multiMode && isRow) {
            this.setupPropertyInput('flex-gap-input', 'gap', styles, editDevice);
            this.setupPropertyInput('flex-wrap-select', 'flexWrap', styles, editDevice, 'select');
        }
        if (multiMode && selectionArray.length) {
            // Bulk-specific property inputs
            if (allAreFlexChildren) {
                this.setupBulkPropertyInput('flex-grow-select', 'flexGrow', editDevice, 'select');
                this.setupBulkPropertyInput('align-self-select', 'alignSelf', editDevice, 'select');
            }
            if (allAreRows) {
                this.setupBulkPropertyInput('flex-gap-input', 'gap', editDevice);
                this.setupBulkPropertyInput('flex-wrap-select', 'flexWrap', editDevice, 'select');
            }
        }

    // Semantic inputs
    if (!multiMode) {
        const tagSel = this.app.querySelector('#semantic-tag');
    if (tagSel) tagSel.addEventListener('change', e => { this.selectedElement.setAttribute('data-user-tag', e.target.value); this.scheduleHistoryCapture('semantic-tag'); this.scheduleAutoGenerate(); });
        const classInput = this.app.querySelector('#semantic-class');
    if (classInput) classInput.addEventListener('input', e => { if (e.target.value.trim()) this.selectedElement.setAttribute('data-user-class', e.target.value.trim()); else this.selectedElement.removeAttribute('data-user-class'); this.scheduleHistoryCapture('semantic-class'); this.scheduleAutoGenerate(); });
        const textInput = this.app.querySelector('#text-content-input');
    if (textInput) textInput.addEventListener('input', e => { this.selectedElement.textContent = e.target.value; this.scheduleHistoryCapture('text'); this.scheduleAutoGenerate(); });
    }
    const bgInput = this.app.querySelector('#bg-color-input');
    if (bgInput) bgInput.addEventListener('input', e => { if (multiMode){ this.applyBulkStyle(editDevice,'backgroundColor', e.target.value);} else { styles[editDevice].backgroundColor = e.target.value; this.selectedElement.dataset.styles = JSON.stringify(styles);} this.applyStyles(); this.scheduleHistoryCapture('prop:bg'); this.scheduleAutoGenerate(); });
    const colorInput = this.app.querySelector('#text-color-input');
    if (colorInput) colorInput.addEventListener('input', e => { if (multiMode){ this.applyBulkStyle(editDevice,'color', e.target.value);} else { styles[editDevice].color = e.target.value; this.selectedElement.dataset.styles = JSON.stringify(styles);} this.applyStyles(); this.scheduleHistoryCapture('prop:color'); this.scheduleAutoGenerate(); });

    // Bulk action listeners
    if (multiMode) {
        const dup = this.app.querySelector('#bulk-duplicate');
        const del = this.app.querySelector('#bulk-delete');
        const wrapRow = this.app.querySelector('#bulk-wrap-row');
        const wrapGrid = this.app.querySelector('#bulk-wrap-grid');
        const copyBtn = this.app.querySelector('#bulk-copy-styles');
        const pasteBtn = this.app.querySelector('#bulk-paste-styles');
        if (dup) dup.addEventListener('click', () => { this.duplicateSelection(); });
        if (del) del.addEventListener('click', () => { this.deleteSelection(); });
        if (wrapRow) wrapRow.addEventListener('click', () => { this.wrapSelection('row'); });
        if (wrapGrid) wrapGrid.addEventListener('click', () => { this.wrapSelection('grid'); });
        if (copyBtn) copyBtn.addEventListener('click', () => { this.copySelectionStyles(); this.updatePropertiesPanel(); });
        if (pasteBtn) pasteBtn.addEventListener('click', () => { if (this.copiedStyles) { this.pasteSelectionStyles(); this.applyStyles(); this.captureSnapshot('bulk-paste'); } });
    }

    // Grid item controls
    if (isGridItem) this.injectGridItemControls(styles, editDevice);
    // Batch override clear
    this.injectBatchClearOverrides(styles);

    // Visibility listeners
    this.setupVisibilityCheckbox('hide-desktop', 'desktop', styles);
    this.setupVisibilityCheckbox('hide-tablet', 'tablet', styles);
    this.setupVisibilityCheckbox('hide-mobile', 'mobile', styles);

        // Set current values
        if (!multiMode) {
            this.app.querySelector('#padding-select').value = currentStyles.padding || '';
            this.app.querySelector('#margin-select').value = currentStyles.margin || '';
        }
        if (!multiMode && isRow) {
            // Append export split toggle if row
            const rowSplitToggleId = 'row-export-split';
            if (!this.app.querySelector('#'+rowSplitToggleId)) {
                const rowPanel = this.app.querySelector('#flex-direction-select')?.closest('.property');
                if (rowPanel) {
                    const wrap = document.createElement('div');
                    wrap.className='property';
                    wrap.innerHTML = `<label style="display:flex; gap:6px; align-items:center; font-size:0.7rem;"><input type="checkbox" id="${rowSplitToggleId}" ${this.selectedElement.dataset.exportSplit==='true'?'checked':''}> <span>Enable drag resize between children (export)</span></label><small style="color:#666;display:block;margin-top:4px;">Adds lightweight JS in exported HTML for adjustable split widths.</small>`;
                    rowPanel.parentElement.insertBefore(wrap, rowPanel.nextSibling);
                    wrap.querySelector('input').addEventListener('change', e=> { this.selectedElement.dataset.exportSplit = e.target.checked ? 'true':'false'; this.scheduleHistoryCapture('row-split-toggle'); });
                }
            }
            this.app.querySelector('#flex-direction-select').value = currentStyles.flexDirection || 'row';
            this.app.querySelector('#justify-content-select').value = currentStyles.justifyContent || 'flex-start';
            this.app.querySelector('#align-items-select').value = currentStyles.alignItems || 'stretch';
        } else {
            if (!multiMode) this.app.querySelector('#flex-grow-select').value = currentStyles.flexGrow || '';
        }
        if (!multiMode && currentStyles.alignSelf && this.app.querySelector('#align-self-select')) this.app.querySelector('#align-self-select').value = currentStyles.alignSelf;
        if (!multiMode && currentStyles.flexWrap && this.app.querySelector('#flex-wrap-select')) this.app.querySelector('#flex-wrap-select').value = currentStyles.flexWrap;
        if (!multiMode && currentStyles.gap && this.app.querySelector('#flex-gap-input')) this.app.querySelector('#flex-gap-input').value = currentStyles.gap;

    // Ensure quick preset buttons reflect current value after panel rebuild
    this.updateQuickButtonStates();
    this.updateDeviceOverrideIndicators(this.selectedElement);
    this.markOverrideInputs();
    this.updateBreadcrumb(this.selectedElement);
    this.updateContrastBadge();
    }

    setupPropertyInput(inputId, styleProperty, styles, device, inputType = 'input') {
        const input = this.app.querySelector(`#${inputId}`);
        if (!input) return;
        const eventName = inputType === 'select' ? 'change' : 'input';
        input.addEventListener(eventName, e => {
            const value = e.target.value;
            if (value) {
                styles[device][styleProperty] = value;
            } else {
                delete styles[device][styleProperty];
            }
            this.selectedElement.dataset.styles = JSON.stringify(styles);
            this.applyStyles();
            this.scheduleHistoryCapture(`prop:${styleProperty}`);
            this.scheduleAutoGenerate();
        });
    }

    setupBulkPropertyInput(inputId, styleProperty, device, inputType = 'input') {
        const input = this.app.querySelector(`#${inputId}`);
        if (!input) return;
        const eventName = inputType === 'select' ? 'change' : 'input';
        input.addEventListener(eventName, e => {
            const value = e.target.value;
            this.applyBulkStyle(device, styleProperty, value);
            this.applyStyles();
            this.scheduleHistoryCapture(`bulk-prop:${styleProperty}`);
            this.scheduleAutoGenerate();
        });
    }

    applyBulkStyle(device, styleProperty, value) {
        this.multiSelected.forEach(el => {
            let styles;
            try {
                styles = JSON.parse(el.dataset.styles || '{}');
            } catch {
                styles = { desktop: {}, tablet: {}, mobile: {} };
            }
            if (!styles[device]) {
                styles[device] = {};
            }
            if (value) {
                styles[device][styleProperty] = value;
            } else {
                delete styles[device][styleProperty];
            }
            el.dataset.styles = JSON.stringify(styles);
        });
    }

    setupResponsiveToggle(element) {
        const toggle = this.app.querySelector('#responsive-stack');
        if (!toggle) return;
        toggle.addEventListener('change', e => {
            element.dataset.responsiveStack = e.target.checked ? 'true' : 'false';
            this.applyStyles();
            this.scheduleHistoryCapture('responsive-stack');
            this.scheduleAutoGenerate();
        });
    }

    setupQuickValues() {
        this.app.querySelectorAll('.quick-btn[data-value]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                const propertyDiv = e.target.closest('.property');
                if (!propertyDiv) return;
                const input = propertyDiv.querySelector('input[type="text"]');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });
    }

    updateQuickButtonStates() {
        this.app.querySelectorAll('.property').forEach(propDiv => {
            const input = propDiv.querySelector('input[type="text"]');
            if (!input) return;
            const currentValue = input.value;
            propDiv.querySelectorAll('.quick-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === currentValue);
            });
        });
    }

    injectBatchClearOverrides(styles) {
        // Placeholder for now
    }

    injectGridItemControls(styles, editDevice) {
        // Placeholder for now
    }

    installPreferenceBindings() {
        const auto = this.app.querySelector('#auto-update-code');
        const prune = this.app.querySelector('#prune-overrides-export');
        const formatSel = this.app.querySelector('#code-format-select');
        const minify = this.app.querySelector('#minify-export');
    if (auto) auto.addEventListener('change', ()=> { this.prefs.autoUpdate = !!auto.checked; this.savePreferences(); if (this.prefs.autoUpdate) this.scheduleAutoGenerate(true); });
    if (prune) prune.addEventListener('change', ()=> { this.prefs.prune = !!prune.checked; this.savePreferences(); this.scheduleAutoGenerate(true); });
    if (formatSel) formatSel.addEventListener('change', ()=> { this.prefs.codeFormat = formatSel.value; this.savePreferences(); this.scheduleAutoGenerate(true); });
        if (minify) minify.addEventListener('change', ()=> { this.prefs.minify = !!minify.checked; this.savePreferences(); this.scheduleAutoGenerate(true); });
    }
    loadPreferences() { try { const json = localStorage.getItem('cssLayout:prefs'); if (!json) return; const p = JSON.parse(json); Object.assign(this.prefs, p||{}); } catch(_) {} }
    savePreferences() { try { localStorage.setItem('cssLayout:prefs', JSON.stringify(this.prefs)); } catch(_){} }
    applyPreferencesToUI() {
        const auto = this.app.querySelector('#auto-update-code'); if (auto) auto.checked = this.prefs.autoUpdate;
        const prune = this.app.querySelector('#prune-overrides-export'); if (prune) prune.checked = this.prefs.prune;
        const formatSel = this.app.querySelector('#code-format-select'); if (formatSel) formatSel.value = this.prefs.codeFormat;
        const minify = this.app.querySelector('#minify-export'); if (minify) minify.checked = this.prefs.minify;
    }
    // --- Reconstructed / Restored Methods (minimal viable implementations) ---
    setActivePropertyDevice(dev){
        this.propertyEditDevice = dev;
        this.prefs.editDevice = dev; this.savePreferences();
        this.updatePropertiesPanel();
    }
    scheduleAutoGenerate(force=false){
        if (!this.prefs.autoUpdate && !force) return;
        clearTimeout(this._autoTimer);
        this._autoTimer = setTimeout(()=> this.generateCode(), 120);
    }
    applyStyles(){
        const device = this.currentDevice;

        const applyTo = (el)=>{
            if (!el.dataset.styles) return;
            let styles; try { styles = JSON.parse(el.dataset.styles); } catch { styles = {desktop:{},tablet:{},mobile:{}}; }
            


            // Support explicit __hidden flag inside styles object (legacy or fallback mechanism)
            const stylesHidden = (device==='desktop' ? (styles.desktop && styles.desktop.__hidden) : (styles[device] && styles[device].__hidden));
            if (stylesHidden) {
                el.style.display='none';
                return;
            }
            // New: dataset-based visibility flags (data-hide-desktop/tablet/mobile) take precedence
            if ((device==='desktop' && el.dataset.hideDesktop==='true') ||
                (device==='tablet' && el.dataset.hideTablet==='true') ||
                (device==='mobile' && el.dataset.hideMobile==='true')) {
                el.style.display='none';
                return;
            }
            const base = {...(styles.desktop||{})};
            const over = device==='desktop'? {} : (styles[device]||{});
            // Legacy support: if a previous version stored display:none in styles for this device, migrate to dataset flag one-time
            const legacyDisplay = device==='desktop'? base.display : over.display;
            if (legacyDisplay === 'none') {
                const flagName = 'hide'+device.charAt(0).toUpperCase()+device.slice(1);
                el.dataset[flagName] = 'true';
                // Attempt to restore original display if known
                if (device==='desktop') {
                    if (el.classList.contains('row')) base.display='flex';
                    else if (el.classList.contains('grid-container')) base.display='grid';
                    else if (el.children.length>0) base.display='flex';
                    else delete base.display;
                    delete styles.desktop.display;
                } else {
                    delete styles[device].display;
                }
                el.dataset.styles = JSON.stringify(styles);
                el.style.display='none';
                return;
            }
            if (el.classList.contains('row')) {
                const stack = el.dataset.responsiveStack === 'true';
                if (stack && (device==='tablet' || device==='mobile') && !('flexDirection' in over)) {
                    base.flexDirection = 'column';
                }
            }
            if (el.classList.contains('grid-container')) {
                const gstack = el.dataset.gridStack === 'true';
                if (gstack && (device==='tablet' || device==='mobile') && !('gridTemplateColumns' in over)) {
                    base.gridTemplateColumns = '1fr';
                }
            }
            const merged = {...base, ...over};
            // Visibility (display none)
            ['display','flexDirection','justifyContent','alignItems','gap','flexWrap','width','height','padding','margin','backgroundColor','color','gridTemplateColumns','justifyItems','alignSelf','gridColumn','gridRow'].forEach(k=>{
                if (merged[k] !== undefined) el.style[k] = merged[k]; else el.style.removeProperty(k.replace(/([A-Z])/g,'-$1').toLowerCase());
            });

        };
        this.preview.querySelectorAll('*').forEach(applyTo);
        this.installResizeHandles();
    }

    setupVisibilityCheckbox(id, device, styles){
        const cb = this.app.querySelector('#'+id);
        if(!cb) return;
        // Consider both dataset flag and legacy display:none setting
        const legacyHidden = styles[device] && styles[device].display === 'none';
        const flagName = 'hide'+device.charAt(0).toUpperCase()+device.slice(1);
        const datasetHidden = this.selectedElement?.dataset?.[flagName] === 'true';
        cb.checked = datasetHidden || legacyHidden;
        
        // Detach any old listener to prevent memory leaks
        const newCb = cb.cloneNode(true);
        cb.parentNode.replaceChild(newCb, cb);

        newCb.addEventListener('change', e=> {
            // Use a fresh reference to the selected element inside the handler
            const currentSelectedElement = this.selectedElement;
            if (!currentSelectedElement) {
                return;
            }

            let currentStyles;
            try {
                currentStyles = JSON.parse(currentSelectedElement.dataset.styles || '{}');
            } catch {
                currentStyles = { desktop: {}, tablet: {}, mobile: {} };
            }

            const elId = currentSelectedElement.getAttribute('data-user-class') || currentSelectedElement.className.split(' ')[0] || currentSelectedElement.tagName;
            
            if(!currentStyles[device]) currentStyles[device] = {};

            if (e.target.checked) {
                currentSelectedElement.dataset[flagName] = 'true';
                currentStyles[device].__hidden = true; // store semantic hidden marker
            } else {
                delete currentSelectedElement.dataset[flagName];
                if (currentStyles[device].__hidden) delete currentStyles[device].__hidden;
            }
            
            // Remove any lingering legacy display:none in styles for this device (we rely solely on dataset flags now)
            if (currentStyles[device].display === 'none') delete currentStyles[device].display;
            currentSelectedElement.dataset.styles = JSON.stringify(currentStyles); // persist potential cleanup
            this.applyStyles();
            this.scheduleAutoGenerate();
        });
    }

    installResizeHandles(){
        // Remove old handles
        this.preview.querySelectorAll('.resize-handle').forEach(h=>h.remove());
        // For each row with >=2 direct flex children (cols or other blocks)
        this.preview.querySelectorAll('.row').forEach(row=>{
            const children = Array.from(row.children).filter(ch=>!ch.classList.contains('resize-handle'));
            if (children.length < 2) return;
            for (let i=0;i<children.length-1;i++){
                const handle = document.createElement('div');
                handle.className='resize-handle';
                // Insert handle after child i
                children[i].after(handle);
                this.bindResizeHandle(handle, children[i], children[i+1]);
            }
        });
    }
    bindResizeHandle(handle, leftEl, rightEl){
        let startX, leftStartW, rightStartW, total;
        const getPercent = (px, parentW)=> ((px/parentW)*100).toFixed(2)+'%';
        const onDown = (e)=>{
            e.preventDefault();
            startX = e.clientX;
            const parent = leftEl.parentElement;
            const rectParent = parent.getBoundingClientRect();
            const rectL = leftEl.getBoundingClientRect();
            const rectR = rightEl.getBoundingClientRect();
            leftStartW = rectL.width; rightStartW = rectR.width; total = rectL.width + rectR.width;
            handle.classList.add('dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        const onMove = (e)=>{
            const dx = e.clientX - startX;
            let newLeft = leftStartW + dx; let newRight = rightStartW - dx;
            if (newLeft < 40 || newRight < 40) return; // minimal width
            const parent = leftEl.parentElement;
            const parentW = parent.getBoundingClientRect().width;
            const leftPct = getPercent(newLeft, parentW);
            const rightPct = getPercent(newRight, parentW);
            this.setElementWidthPercent(leftEl, leftPct);
            this.setElementWidthPercent(rightEl, rightPct);
            this.applyStyles();
        };
        const onUp = ()=>{
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            handle.classList.remove('dragging');
            this.captureSnapshot('resize-cols');
        };
        handle.addEventListener('mousedown', onDown);
    }
    setElementWidthPercent(el, pct){
        let styles; try { styles = JSON.parse(el.dataset.styles||'{}'); } catch { styles = {desktop:{},tablet:{},mobile:{}}; }
        styles.desktop = styles.desktop || {}; // width adjustments are desktop baseline
        styles.desktop.width = pct;
        el.dataset.styles = JSON.stringify(styles);
    }
    duplicateSelection(){
        const clones = [];
        this.multiSelected.forEach(el=>{
            const clone = el.cloneNode(true);
            el.parentElement.insertBefore(clone, el.nextSibling);
            clones.push(clone);
        });
        this.applyStyles();
        this.captureSnapshot('duplicate');
    }
    deleteSelection(){
        this.multiSelected.forEach(el=> el.remove());
        this.multiSelected.clear();
        this.selectedElement = null;
        this.updatePropertiesPanel();
        this.captureSnapshot('delete');
    }
    wrapSelection(kind){
        if (!this.multiSelected.size) return;
        const first = Array.from(this.multiSelected)[0];
        const container = document.createElement('div');
        if (kind==='row') { container.classList.add('row'); container.dataset.styles = JSON.stringify({desktop:{display:'flex', flexDirection:'row'}, tablet:{}, mobile:{}}); }
        else { container.classList.add('grid-container'); container.dataset.styles = JSON.stringify({desktop:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}, tablet:{}, mobile:{}}); }
        container.dataset.responsiveStack = 'false';
        first.parentElement.insertBefore(container, first);
        Array.from(this.multiSelected).forEach(el=> container.appendChild(el));
        this.multiSelected.clear();
        container.classList.add('selected');
        this.selectedElement = container;
        this.updatePropertiesPanel();
        this.applyStyles();
        this.captureSnapshot('wrap:'+kind);
    }
    copySelectionStyles(){
        if (!this.multiSelected.size) return;
        this.copiedStyles = Array.from(this.multiSelected).map(el=> el.dataset.styles || '{}');
    }
    pasteSelectionStyles(){
        if (!this.copiedStyles) return;
        const src = this.copiedStyles[0];
        this.multiSelected.forEach(el=> el.dataset.styles = src);
        this.applyStyles();
        this.captureSnapshot('paste-styles');
    }
    handleKeyShortcuts(e){
        if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='d'){ if (this.multiSelected.size) { e.preventDefault(); this.duplicateSelection(); } }
        if (e.key==='Delete' || e.key==='Backspace'){ if (this.multiSelected.size){ e.preventDefault(); this.deleteSelection(); } }
        if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); this.undo(); }
        if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); this.redo(); }
    }
    serializeLayout(){ return this.preview.innerHTML; }
    restoreLayout(html){ this.preview.innerHTML = html; this.applyStyles(); }
    autoRestoreFromLocal(){ try { const html = localStorage.getItem('cssLayout:last'); if (html) { this.restoreLayout(html); } } catch(_){} }
    downloadLayout(){ const data = { html: this.serializeLayout() }; const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='layout.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 500); }
    handleFileLoad(e){ const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (data.html) this.restoreLayout(data.html); } catch(_){} }; reader.readAsText(file); }
    clearCanvas(){ this.preview.innerHTML=''; this.multiSelected.clear(); this.selectedElement=null; this.updatePropertiesPanel(); this.captureSnapshot('clear'); }
    captureSnapshot(label='change'){
        const snap = this.serializeLayout();
        this.undoStack.push({html:snap,label});
        if (this.undoStack.length>this.maxHistory) this.undoStack.shift();
        this.redoStack.length = 0;
        try { localStorage.setItem('cssLayout:last', snap); } catch(_){}
        this.updateHistoryButtons();
    }
    scheduleHistoryCapture(label){
        this._pendingHistoryLabel = label;
        clearTimeout(this._historyDebounce);
        this._historyDebounce = setTimeout(()=> this.captureSnapshot(this._pendingHistoryLabel), 400);
    }
    undo(){ if (this.undoStack.length<=1) return; const current = this.undoStack.pop(); this.redoStack.push(current); const last = this.undoStack[this.undoStack.length-1]; this.restoreLayout(last.html); this.updateHistoryButtons(); }
    redo(){ if (!this.redoStack.length) return; const snap = this.redoStack.pop(); this.undoStack.push(snap); this.restoreLayout(snap.html); this.updateHistoryButtons(); }
    updateHistoryButtons(){ const u=this.app.querySelector('#undo-btn'); const r=this.app.querySelector('#redo-btn'); if (u) u.disabled = this.undoStack.length<=1; if (r) r.disabled = !this.redoStack.length; }
    pruneRedundantDeviceStyles(){ /* placeholder no-op for simplified restoration */ }
    updateDeviceOverrideIndicators(){ /* placeholder */ }
    markOverrideInputs(){ /* placeholder */ }
    buildVisibilityNotes(){ return ''; }
    // --- End reconstructed methods ---
    minifyCSS(css){
        return css
            .replace(/\/\*[\s\S]*?\*\//g,'') // remove comments
            .replace(/\s+/g,' ') // collapse whitespace
            .replace(/\s*{\s*/g,'{')
            .replace(/\s*}\s*/g,'}')
            .replace(/;\s+/g,';')
            .replace(/:\s+/g,':')
            .trim();
    }
    prepareExportSplits(root){
    const splitRows = Array.from(root.querySelectorAll('[data-export-split="true"]'));
    const splitCols = Array.from(root.querySelectorAll('[data-export-vsplit="true"]'));
    if (!splitRows.length && !splitCols.length) return;
    splitRows.forEach(r=>{ r.classList.add('split-row'); r.removeAttribute('data-export-split'); });
    splitCols.forEach(c=>{ c.classList.add('split-col'); c.removeAttribute('data-export-vsplit'); });
    if (root.querySelector('[data-split-script]')) return;
    const remember = this.app.querySelector('#remember-splits')?.checked ? 'true':'false';
    const tpl = document.createElement('template');
    tpl.innerHTML = `\n<style>.split-row{display:flex;}.split-row>.split-handle{flex:0 0 6px;cursor:col-resize;background:rgba(0,0,0,0.1);position:relative;border-radius:3px;}.split-row>.split-handle:before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:2px;height:60%;background:rgba(0,0,0,0.35);border-radius:1px;}.split-row>.split-handle:hover{background:rgba(0,0,0,0.25);} .split-col{display:flex;flex-direction:column;}.split-col>.split-handle-v{height:6px;cursor:row-resize;background:rgba(0,0,0,0.1);position:relative;border-radius:3px;}.split-col>.split-handle-v:before{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:2px;width:60%;background:rgba(0,0,0,0.35);border-radius:1px;}.split-col>.split-handle-v:hover{background:rgba(0,0,0,0.25);} </style>\n<script data-split-script>(function(){const REMEMBER=${remember};const KEY='layout-splits';let store={};try{store=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}})();<\/script>`;
    root.appendChild(tpl.content);
    }
    loadPreset(name){
        if (!name) return;
        this.clearCanvas();
        const add = (type)=>{ this.addElement(type); return this.preview.lastElementChild; };
        const make = (cls, baseStyles)=>{ const el=document.createElement('div'); el.classList.add(cls); el.dataset.styles=JSON.stringify(baseStyles); el.dataset.responsiveStack='false'; return el; };
        const baseFlex = (dir='row')=>({desktop:{display:'flex',flexDirection:dir,flexGrow:'1',gap:'16px'},tablet:{},mobile:{}});
        const baseGrid = (cols='1fr 1fr')=>({desktop:{display:'grid',gridTemplateColumns:cols,gap:'16px'},tablet:{},mobile:{}});
        switch(name){
            case 'header-content-footer': {
                const header = make('row', baseFlex('row')); header.setAttribute('data-user-tag','header'); header.textContent='Header'; this.preview.appendChild(header);
                const main = make('row', baseFlex('row')); main.setAttribute('data-user-tag','main'); main.textContent='Main Content'; this.preview.appendChild(main);
                const footer = make('row', baseFlex('row')); footer.setAttribute('data-user-tag','footer'); footer.textContent='Footer'; this.preview.appendChild(footer);
                break; }
            case 'sidebar-layout': {
                const shell = make('row', baseFlex('row')); shell.style.minHeight='400px'; this.preview.appendChild(shell);
                const side = make('col', baseFlex('column')); side.style.width='240px'; side.textContent='Sidebar'; shell.appendChild(side);
                const content = make('col', baseFlex('column')); content.textContent='Content Area'; shell.appendChild(content);
                break; }
            case 'sidebar-right-layout': {
                const shell = make('row', baseFlex('row')); this.preview.appendChild(shell);
                const content = make('col', baseFlex('column')); content.textContent='Content Area'; shell.appendChild(content);
                const side = make('col', baseFlex('column')); side.style.width='240px'; side.textContent='Right Sidebar'; shell.appendChild(side);
                break; }
            case 'dashboard-app-shell': {
                const root = make('col', baseFlex('column')); this.preview.appendChild(root);
                const header = make('row', baseFlex('row')); header.textContent='App Header'; root.appendChild(header);
                const body = make('row', baseFlex('row')); body.style.flexGrow='1'; root.appendChild(body);
                const nav = make('col', baseFlex('column')); nav.style.width='220px'; nav.textContent='Nav'; body.appendChild(nav);
                const main = make('col', baseFlex('column')); main.textContent='Main Workspace'; body.appendChild(main);
                const status = make('row', baseFlex('row')); status.textContent='Status Bar'; app.appendChild(status);
                break; }
            case 'grid-2col-hero': {
                const hero = make('grid-container', baseGrid('1fr 1fr')); this.preview.appendChild(hero);
                for (let i=0;i<2;i++){ const cell=document.createElement('div'); cell.classList.add('grid-item'); cell.dataset.styles=JSON.stringify({desktop:{},tablet:{},mobile:{}}); cell.textContent = i===0? 'Hero Text' : 'Image'; hero.appendChild(cell);} break; }
            case 'grid-gallery': {
                const gal = make('grid-container', baseGrid('1fr 1fr 1fr')); this.preview.appendChild(gal);
                for (let i=0;i<6;i++){ const cell=document.createElement('div'); cell.classList.add('grid-item'); cell.dataset.styles=JSON.stringify({desktop:{},tablet:{},mobile:{}}); cell.textContent='Item '+(i+1); gal.appendChild(cell);} break; }
            case 'form-page': {
                const shell = make('row', baseFlex('row')); this.preview.appendChild(shell);
                const main = make('col', baseFlex('column')); main.style.flexGrow='1'; shell.appendChild(main);
                const aside = make('col', baseFlex('column')); aside.style.width='280px'; aside.textContent='Help / Tips'; shell.appendChild(aside);
                const title = make('row', baseFlex('row')); title.textContent='Page Title'; main.appendChild(title);
                const form = make('col', baseFlex('column')); form.textContent='Form Fields'; main.appendChild(form);
                break; }
            case 'win-classic': {
                const app = make('col', baseFlex('column')); this.preview.appendChild(app);
                const menu = make('row', baseFlex('row')); menu.textContent='Menu Bar'; app.appendChild(menu);
                const body = make('row', baseFlex('row')); body.style.flexGrow='1'; app.appendChild(body);
                const side = make('col', baseFlex('column')); side.style.width='200px'; side.textContent='Tree / Nav'; body.appendChild(side);
                const workspace = make('col', baseFlex('column')); workspace.textContent='Document Workspace'; body.appendChild(workspace);
                const status = make('row', baseFlex('row')); status.textContent='Status Bar'; app.appendChild(status);
                break; }
            case 'blog-post': {
                const layout = make('row', baseFlex('row')); this.preview.appendChild(layout);
                const main = make('col', baseFlex('column')); main.style.flexGrow='1'; layout.appendChild(main);
                const aside = make('col', baseFlex('column')); aside.style.width='260px'; aside.textContent='Sidebar'; layout.appendChild(aside);
                const title = make('row', baseFlex('row')); title.textContent='Post Title'; main.appendChild(title);
                const meta = make('row', baseFlex('row')); meta.textContent='Meta Info'; main.appendChild(meta);
                const body = make('col', baseFlex('column')); body.textContent='Article Body'; main.appendChild(body);
                break; }
            default: break;
        }
        this.applyStyles();
        this.captureSnapshot('preset:'+name);
        this.showBeginnerTipsOnce();
    }
    showBeginnerTipsOnce(){
        if (this._tipsShown) return; this._tipsShown = true;
        const box = document.createElement('div');
        box.style.cssText='position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:12px 14px;border-radius:6px;font-size:12px;max-width:280px;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:9999;';
        box.innerHTML = `<strong>Next steps</strong><br>1. Select boxes to edit properties.<br>2. Use Responsive tabs (D/T/M) to tweak per device.<br>3. Fill real text in leaf elements.<br>4. Export code (choose CSS or Tailwind).<br><br><em>Tip:</em> Turn on Minify for production.`;
        const close = document.createElement('button'); close.textContent='×'; close.style.cssText='position:absolute;top:2px;right:6px;background:none;border:none;color:#fff;font-size:14px;cursor:pointer;'; close.addEventListener('click',()=>box.remove()); box.appendChild(close);
        document.body.appendChild(box);
        setTimeout(()=>{ if (box.parentNode) box.remove(); }, 15000);
    }
    // ===== New: Breadcrumb =====
    updateBreadcrumb(el){
        const bc = this.app.querySelector('#breadcrumb'); if(!bc) return;
        if(!el){ bc.innerHTML=''; return; }
        const parts=[]; let cur=el; while(cur && cur!==this.preview){ parts.push(cur); cur=cur.parentElement; }
        parts.reverse();
        bc.innerHTML = parts.map((p,i)=>`<button data-bc-idx="${i}" class="crumb">${p.getAttribute('data-user-class')||p.getAttribute('data-user-tag')||p.className.split(' ')[0]||'div'}</button>`).join('<span class="crumb-sep">/</span>');
        bc.querySelectorAll('button[data-bc-idx]').forEach(btn=> btn.addEventListener('click', ()=> {
            const idx = parseInt(btn.getAttribute('data-bc-idx'),10);
            const target = parts[idx];
            if(this.selectedElement) this.selectedElement.classList.remove('selected');
            this.selectedElement = target; target.classList.add('selected');
            this.multiSelected.clear();
            this.updatePropertiesPanel();
        }));
    }
    // ===== New: Color Contrast Badge =====
    parseColor(c){ if(!c) return null; const ctx=document.createElement('canvas').getContext('2d'); ctx.fillStyle=c; const v=ctx.fillStyle; // standardized
        if(/^#/.test(v)){ let hex=v.slice(1); if(hex.length===3) hex=hex.split('').map(h=>h+h).join(''); const num=parseInt(hex,16); return {r:(num>>16)&255,g:(num>>8)&255,b:num&255}; }
        const m=v.match(/rgba?\((\d+),(\d+),(\d+)/); if(m) return {r:+m[1],g:+m[2],b:+m[3]}; return null; }
    relLum({r,g,b}){ const sr=[r,g,b].map(v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*sr[0]+0.7152*sr[1]+0.0722*sr[2]; }
    contrastRatio(c1,c2){ if(!c1||!c2) return 0; const L1=this.relLum(c1)+0.05; const L2=this.relLum(c2)+0.05; return L1>L2? (L1/L2):(L2/L1); }
    updateContrastBadge(){
        const badgeId='contrast-badge';
        const existing = this.app.querySelector('#'+badgeId);
        const panel = this.app.querySelector('#properties-panel-content'); if(!panel) return;
        if(!this.selectedElement || this.multiSelected.size>1){ if(existing) existing.remove(); return; }
        let styles; try { styles=JSON.parse(this.selectedElement.dataset.styles||'{}'); } catch { styles={desktop:{},tablet:{},mobile:{}}; }
        const dev=this.propertyEditDevice||'desktop';
        const bg=styles[dev].backgroundColor || styles.desktop.backgroundColor || '#ffffff';
        const fg=styles[dev].color || styles.desktop.color || '#000000';
        const c1=this.parseColor(bg), c2=this.parseColor(fg); const ratio=this.contrastRatio(c1,c2);
        const passAA = ratio>=4.5; const passAAA = ratio>=7;
        const text = `Contrast ${ratio?ratio.toFixed(2):'–'} ${passAAA? '(AAA)': (passAA? '(AA)':'(Fail)')}`;
        if(existing){ existing.textContent=text; existing.className='contrast-badge '+(passAA?'pass':'fail'); return; }
        const badge=document.createElement('div'); badge.id=badgeId; badge.className='contrast-badge '+(passAA?'pass':'fail'); badge.textContent=text; panel.prepend(badge);
    }
    // ===== New: Validation =====
    runValidation(){
        const issues=this.computeValidationIssues();
        const container=this.app.querySelector('#validation-results'); if(!container) return;
        if(!issues.length){ container.innerHTML='<div class="ok">No issues detected.</div>'; return; }
        const listHtml = issues.map((iss,i)=>`<div class="issue" data-code="${iss.code}"><span>${iss.message}</span>${iss.fix?`<button data-fix="${i}">Fix</button>`:''}</div>`).join('');
        const anyFixable = issues.some(i=>!!i.fix);
        container.innerHTML = listHtml + (anyFixable?`<div class="val-actions"><button id="fix-all-btn">Fix All</button></div>`:'');
        container.querySelectorAll('button[data-fix]').forEach(btn=> btn.addEventListener('click',()=>{ const idx=+btn.getAttribute('data-fix'); const issue=issues[idx]; if(issue && issue.fix){ issue.fix(); this.applyStyles(); this.captureSnapshot('fix:'+issue.code); this.runValidation(); }}));
        if(anyFixable){
            container.querySelector('#fix-all-btn').addEventListener('click',()=>{
                issues.forEach(iss=>{ if(iss.fix) iss.fix(); });
                this.applyStyles();
                this.captureSnapshot('fix-all');
                this.runValidation();
            });
        }
    }
    computeValidationIssues(){
        const out=[]; const all=[...this.preview.querySelectorAll('*')];
        all.forEach(el=>{
            if(!el.dataset.styles) return;
            let st; try{ st=JSON.parse(el.dataset.styles);}catch{ return; }
            const desk=st.desktop||{}; if(desk.flexGrow && desk.width && /%|px/.test(desk.width)) out.push({code:'flex-width', message:'Element has both flexGrow and fixed width; consider removing width for flexible layout.', fix:()=>{ delete desk.width; el.dataset.styles=JSON.stringify(st);} });
            if(!el.children.length && !el.textContent.trim()) out.push({code:'empty-leaf', message:'Empty leaf element (no text or children).', fix:()=>{ el.textContent='Placeholder'; }});
            if(el.children.length && !el.classList.contains('grid-container') && !el.classList.contains('row') && !el.classList.contains('col')) out.push({code:'untyped-container', message:'Non-semantic container; consider adding a semantic tag/class.', fix:null});
        });
        return out;
    }
    // ===== New: Components =====
    loadComponents(){ try{ const json=localStorage.getItem('cssLayout:components'); this._components=json? JSON.parse(json):[]; }catch{ this._components=[]; } }
    saveComponents(){ try{ localStorage.setItem('cssLayout:components', JSON.stringify(this._components)); }catch(_){} }
    updateComponentSaveButton(){ const btn=this.app.querySelector('#save-component-btn'); if(btn) btn.disabled = !this.selectedElement || !this.app.querySelector('#component-name').value.trim(); }
    saveCurrentComponent(){ if(!this.selectedElement) return; const name=this.app.querySelector('#component-name').value.trim(); if(!name) return; this._components.push({name, html:this.selectedElement.outerHTML}); this.saveComponents(); this.renderComponentList(); }
    renderComponentList(){ const list=this.app.querySelector('#component-list'); if(!list) return; list.innerHTML = this._components.map((c,i)=>`<li><button data-insert-comp="${i}" title="Insert component">${c.name}</button></li>`).join(''); list.querySelectorAll('button[data-insert-comp]').forEach(btn=> btn.addEventListener('click',()=>{ const idx=+btn.getAttribute('data-insert-comp'); const comp=this._components[idx]; if(!comp) return; const tpl=document.createElement('template'); tpl.innerHTML=comp.html.trim(); const node=tpl.content.firstElementChild; if(node){ this.preview.appendChild(node); this.applyStyles(); this.captureSnapshot('insert-comp'); } })); }
}

new CSSEditor(document.getElementById('app'));