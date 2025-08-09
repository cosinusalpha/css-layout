class CSSEditor {
    constructor(app) {
        this.app = app;
    // Device used for editing per-element responsive styles (separate from preview width)
    this.propertyEditDevice = 'desktop';
    // Explicit device state for preview (avoid relying on measured widths which can be stale)
    this.currentDevice = 'desktop';
        this.render();
    }

    render() {
        this.app.innerHTML = `
            <div class="panel" id="left-panel">
                <h2>Elements</h2>
                <div id="element-controls">
                    <button id="add-row-btn">Add Row</button>
                    <button id="add-col-btn">Add Column</button>
                    <button id="add-grid-btn">Add Grid</button>
                </div>
                <button id="clear-btn">Clear Canvas</button>
                <div class="preset-container">
                    <label for="preset-select">Presets</label>
                    <select id="preset-select">
                        <option value="">Select a preset</option>
                        <option value="header-content-footer">Header, Content, Footer</option>
                        <option value="sidebar-layout">Sidebar Layout</option>
                        <option value="grid-2col-hero">Grid 2-Col Hero</option>
                    </select>
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
                                        <label style="display:flex; align-items:center; gap:6px; font-size:0.7rem; margin:6px 0 10px;">
                                            <input type="checkbox" id="auto-update-code" checked>
                                            <span>Auto Update Code</span>
                                        </label>
                    <button id="generate-code-btn">Generate Code</button>
                                        <button id="open-code-modal-btn">Open Large Viewer</button>
                    <pre id="html-code"></pre>
                    <pre id="css-code"></pre>
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
                        </div>
        `;

        this.preview = this.app.querySelector('#preview');

        this.app.querySelector('#desktop-btn').addEventListener('click', () => this.setDevice('desktop'));
        this.app.querySelector('#tablet-btn').addEventListener('click', () => this.setDevice('tablet'));
        this.app.querySelector('#mobile-btn').addEventListener('click', () => this.setDevice('mobile'));

        this.app.querySelector('#add-row-btn').addEventListener('click', () => this.addElement('row'));
        this.app.querySelector('#add-col-btn').addEventListener('click', () => this.addElement('col'));
    this.app.querySelector('#add-grid-btn').addEventListener('click', () => this.addElement('grid'));

    this.selectedElement = null;
        this.preview.addEventListener('click', (e) => this.selectElement(e));
        this.app.querySelector('#generate-code-btn').addEventListener('click', () => this.generateCode());
    this.app.querySelector('#open-code-modal-btn').addEventListener('click', () => this.openCodeModal());
        this.app.querySelector('#clear-btn').addEventListener('click', () => this.clearCanvas());
        this.app.querySelector('#preset-select').addEventListener('change', (e) => this.loadPreset(e.target.value));

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
    }

    selectElement(e) {
        if (e.target === this.preview) return;
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
        }
        this.selectedElement = e.target;
        this.selectedElement.classList.add('selected');
        this.updatePropertiesPanel();
        e.stopPropagation();
    }

    generateCode() {
    if (this._generating) return; // guard
    this._generating = true;
        const format = this.app.querySelector('#code-format-select').value;
        const previewClone = this.preview.cloneNode(true);
        
        if (format === 'tailwind') {
            this.generateTailwind(previewClone);
            const visibilityNotes = this.buildVisibilityNotes(previewClone, 'tailwind');
            this.cleanupForExport(previewClone);
            const htmlContent = this.extractInnerContent(previewClone);
            this.app.querySelector('#html-code').textContent = this.formatHTML(htmlContent);
            this.app.querySelector('#css-code').textContent = '/* Tailwind CSS classes are applied directly in the HTML. */' + (visibilityNotes ? `\n\n/* Visibility Notes:\n${visibilityNotes}\n*/` : '');
        } else {
            const cssRules = this.generateCSS(previewClone);
            const visibilityNotes = this.buildVisibilityNotes(previewClone, 'css');
            this.cleanupForExport(previewClone);
            const htmlContent = this.extractInnerContent(previewClone);
            this.app.querySelector('#html-code').textContent = this.formatHTML(htmlContent);
            this.app.querySelector('#css-code').textContent = cssRules + (visibilityNotes ? `\n/* Visibility Notes:\n${visibilityNotes}\n*/\n` : '');
        }
    // Sync modal content if open
    if (this.codeModalOpen) this.syncModalCode();
    this.generatedOnce = true;
    this._generating = false;
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
                const predefined = { '0':'gap-0','4px':'gap-1','8px':'gap-2','12px':'gap-3','16px':'gap-4','20px':'gap-5','24px':'gap-6','32px':'gap-8'};
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
            el.removeAttribute('data-styles');
                el.removeAttribute('data-responsive-stack');
            el.removeAttribute('contenteditable');
            if (el.textContent.trim() === 'Row' || el.textContent.trim() === 'Col') {
                el.textContent = '';
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
        } catch(e) {
            return html;
        }
    }

    generateCSS(element) {
        let cssText = '';
        const elementsWithStyle = Array.from(element.querySelectorAll('[data-styles]'));
        elementsWithStyle.forEach((el, i) => {
            const className = `layout-el-${i + 1}`;
            el.classList.add(className);
            const styles = JSON.parse(el.dataset.styles);
                const isRow = el.classList.contains('row');
            const isGrid = el.classList.contains('grid-container');
                const responsiveStack = el.dataset.responsiveStack === 'true';
            const gridStack = el.dataset.gridStack === 'true';
            
            let css = '';
            for(const device in styles) {
                const deviceStyles = styles[device];
                    if ((device === 'tablet' || device === 'mobile') && responsiveStack && isRow && !('flexDirection' in deviceStyles)) {
                        deviceStyles.flexDirection = 'column';
                    }
                    if ((device === 'tablet' || device === 'mobile') && gridStack && isGrid && !('gridTemplateColumns' in deviceStyles)) {
                        deviceStyles.gridTemplateColumns = '1fr';
                    }
                if(Object.keys(deviceStyles).length > 0) {
                    if (device === 'desktop') {
                        css += `.${className} {
${this.formatCSS(deviceStyles)}}

`;
                    } else {
                        const media = device === 'tablet' ? '@media (max-width: 768px)' : '@media (max-width: 375px)';
                        css += `${media} {
  .${className} {
${this.formatCSS(deviceStyles, '    ')}}
}

`;
                    }
                }
            }
            cssText += css;
        });
        return cssText;
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
            return;
        }

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
    panelContent.innerHTML = `
            ${responsiveStackUI}
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
                        `}
        `;

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
        this.setupPropertyInput('width-input', 'width', styles, editDevice);
        this.setupPropertyInput('height-input', 'height', styles, editDevice);
        this.setupPropertyInput('padding-select', 'padding', styles, editDevice, 'select');
        this.setupPropertyInput('margin-select', 'margin', styles, editDevice, 'select');
        
        if (isRow) {
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
                });
            }
            this.app.querySelectorAll('[data-gridcols]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const n = parseInt(btn.dataset.gridcols,10);
                    styles[editDevice].gridTemplateColumns = Array.from({length:n}).map(()=> '1fr').join(' ');
                    if (colCountInput) colCountInput.value = n;
                    this.selectedElement.dataset.styles = JSON.stringify(styles);
                    this.applyStyles();
                });
            });
            const gapInput = this.app.querySelector('#grid-gap-input');
            const gapPreset = this.app.querySelector('#grid-gap-preset');
            const updateGap = (val) => {
                styles[editDevice].gap = val;
                this.selectedElement.dataset.styles = JSON.stringify(styles);
                this.applyStyles();
            };
            if (gapInput) gapInput.addEventListener('input', e => updateGap(e.target.value));
            if (gapPreset) {
                gapPreset.value = styles[editDevice].gap || '';
                gapPreset.addEventListener('change', e => { if (e.target.value) { gapInput.value = e.target.value; updateGap(e.target.value); }});
            }
            const justifyItemsSel = this.app.querySelector('#justify-items-select');
            if (justifyItemsSel) {
                justifyItemsSel.value = styles[editDevice].justifyItems || '';
                justifyItemsSel.addEventListener('change', e => { if (e.target.value) styles[editDevice].justifyItems = e.target.value; else delete styles[editDevice].justifyItems; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); });
            }
            const alignItemsGridSel = this.app.querySelector('#align-items-grid-select');
            if (alignItemsGridSel) {
                alignItemsGridSel.value = styles[editDevice].alignItems || '';
                alignItemsGridSel.addEventListener('change', e => { if (e.target.value) styles[editDevice].alignItems = e.target.value; else delete styles[editDevice].alignItems; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); });
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
                    this.applyStyles();
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
                    this.applyStyles();
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
                this.applyStyles();
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
                this.applyStyles();
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
                colSpanInput.addEventListener('input', applySpan);
                rowSpanInput.addEventListener('input', applySpan);
                if (styles[editDevice].gridColumn) { const m = styles[editDevice].gridColumn.match(/span (\d+)/); if (m) colSpanInput.value = m[1]; }
                if (styles[editDevice].gridRow) { const m2 = styles[editDevice].gridRow.match(/span (\d+)/); if (m2) rowSpanInput.value = m2[1]; }
                if (clearBtn) clearBtn.addEventListener('click', () => { delete styles[editDevice].gridColumn; delete styles[editDevice].gridRow; colSpanInput.value=''; rowSpanInput.value=''; this.selectedElement.dataset.styles = JSON.stringify(styles); this.applyStyles(); });
            }
        } else {
            this.setupPropertyInput('flex-grow-select', 'flexGrow', styles, editDevice, 'select');
        }

    // Visibility listeners
    this.setupVisibilityCheckbox('hide-desktop', 'desktop', styles);
    this.setupVisibilityCheckbox('hide-tablet', 'tablet', styles);
    this.setupVisibilityCheckbox('hide-mobile', 'mobile', styles);

        // Set current values
        this.app.querySelector('#padding-select').value = currentStyles.padding || '';
        this.app.querySelector('#margin-select').value = currentStyles.margin || '';
        if (isRow) {
            this.app.querySelector('#flex-direction-select').value = currentStyles.flexDirection || 'row';
            this.app.querySelector('#justify-content-select').value = currentStyles.justifyContent || 'flex-start';
            this.app.querySelector('#align-items-select').value = currentStyles.alignItems || 'stretch';
        } else {
            this.app.querySelector('#flex-grow-select').value = currentStyles.flexGrow || '';
        }

    // Ensure quick preset buttons reflect current value after panel rebuild
    this.updateQuickButtonStates();
    }

    fastUpdatePropertyValues(device) {
        if (!this.selectedElement) return false;
        const panelContent = this.app.querySelector('#properties-panel-content');
        if (!panelContent || !panelContent.hasAttribute('data-panel-kind')) return false;
        // Parse styles
        let styles;
        try { styles = JSON.parse(this.selectedElement.dataset.styles || '{}'); } catch(_) { return false; }
        if (!styles[device]) styles[device] = {};
        const currentStyles = styles[device];
        // Generic inputs
        const widthInput = this.app.querySelector('#width-input');
        const heightInput = this.app.querySelector('#height-input');
        if (!widthInput || !heightInput) return false; // panel structure changed; fallback to full rebuild
        widthInput.value = currentStyles.width || '';
        heightInput.value = currentStyles.height || '';
        const padSel = this.app.querySelector('#padding-select'); if (padSel) padSel.value = currentStyles.padding || '';
        const marSel = this.app.querySelector('#margin-select'); if (marSel) marSel.value = currentStyles.margin || '';
        // Row specific
        if (this.selectedElement.classList.contains('row')) {
            const fd = this.app.querySelector('#flex-direction-select'); if (fd) fd.value = currentStyles.flexDirection || 'row';
            const jc = this.app.querySelector('#justify-content-select'); if (jc) jc.value = currentStyles.justifyContent || 'flex-start';
            const ai = this.app.querySelector('#align-items-select'); if (ai) ai.value = currentStyles.alignItems || 'stretch';
        }
        // Grid container specific
        if (this.selectedElement.classList.contains('grid-container')) {
            const colCountInput = this.app.querySelector('#grid-col-count');
            if (colCountInput) {
                const cols = (currentStyles.gridTemplateColumns||'').split(/\s+/).filter(Boolean);
                if (cols.length) colCountInput.value = cols.length; else if (device==='desktop') colCountInput.value = (styles.desktop.gridTemplateColumns||'1fr 1fr').split(/\s+/).filter(Boolean).length;
            }
            const gapInput = this.app.querySelector('#grid-gap-input'); if (gapInput) gapInput.value = currentStyles.gap || styles.desktop.gap || '16px';
            const justifyItemsSel = this.app.querySelector('#justify-items-select'); if (justifyItemsSel) justifyItemsSel.value = currentStyles.justifyItems || '';
            const alignItemsGridSel = this.app.querySelector('#align-items-grid-select'); if (alignItemsGridSel) alignItemsGridSel.value = currentStyles.alignItems || '';
        }
        // Grid item specific
        if (this.selectedElement.classList.contains('grid-item')) {
            const colSpanInput = this.app.querySelector('#grid-col-span');
            const rowSpanInput = this.app.querySelector('#grid-row-span');
            if (colSpanInput && rowSpanInput) {
                if (currentStyles.gridColumn) { const m = currentStyles.gridColumn.match(/span (\d+)/); colSpanInput.value = m? m[1]:''; } else colSpanInput.value='';
                if (currentStyles.gridRow) { const m2 = currentStyles.gridRow.match(/span (\d+)/); rowSpanInput.value = m2? m2[1]:''; } else rowSpanInput.value='';
            }
        }
        // Flex child
        if (!this.selectedElement.classList.contains('row') && !this.selectedElement.classList.contains('grid-container') && !this.selectedElement.classList.contains('grid-item')) {
            const fg = this.app.querySelector('#flex-grow-select'); if (fg) fg.value = currentStyles.flexGrow || '';
        }
        // Visibility checkboxes
        const visDesktop = this.app.querySelector('#hide-desktop'); if (visDesktop) visDesktop.checked = styles.desktop.display === 'none';
        const visTablet = this.app.querySelector('#hide-tablet'); if (visTablet) visTablet.checked = styles.tablet.display === 'none';
        const visMobile = this.app.querySelector('#hide-mobile'); if (visMobile) visMobile.checked = styles.mobile.display === 'none';
        // Quick buttons highlight
        this.updateQuickButtonStates();
        return true;
    }

    setupVisibilityCheckbox(id, deviceKey, styles) {
        const el = this.app.querySelector(`#${id}`);
        if (!el) return;
        el.addEventListener('change', (e) => {
            const deviceStyles = styles[deviceKey];
            if (e.target.checked) {
                deviceStyles.display = 'none';
            } else if (deviceStyles.display === 'none') {
                delete deviceStyles.display;
            }
            this.selectedElement.dataset.styles = JSON.stringify(styles);
            this.applyStyles();
        });
    }

    buildVisibilityNotes(root, format) {
        const notes = [];
        root.querySelectorAll('[data-styles]').forEach((el, idx) => {
            try {
                const s = JSON.parse(el.dataset.styles);
                const hiddenOn = [];
                ['desktop','tablet','mobile'].forEach(d => { if (s[d] && s[d].display === 'none') hiddenOn.push(d); });
                if (hiddenOn.length) {
                    let ref = '';
                    if (format === 'css') {
                        const cls = Array.from(el.classList).find(c => /^layout-el-/.test(c));
                        ref = cls ? `.${cls}` : `Element #${idx+1}`;
                    } else {
                        ref = el.className ? el.className.split(/\s+/)[0] : (el.textContent.trim().slice(0,30) || `Element #${idx+1}`);
                    }
                    notes.push(`${ref} hidden on: ${hiddenOn.join(', ')}. Toggle via JS: el.style.display = (el.style.display==='none'?'':'none');`);
                }
            } catch(_) {}
        });
        return notes.join('\n');
    }

    setupResponsiveToggle(targetRow) {
        const checkbox = this.app.querySelector('#responsive-stack');
        if (!checkbox || !targetRow) return;
        checkbox.addEventListener('change', (e) => {
            targetRow.dataset.responsiveStack = e.target.checked ? 'true' : 'false';
            // Do NOT mutate stored mobile styles here; runtime logic will handle layout change
            this.applyStyles();
        });
    }

    setupQuickValues() {
        this.app.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const propEl = e.target.closest('.property');
                if (!propEl) return;
                const input = propEl.querySelector('input');
                if (!input) return;
                input.value = e.target.dataset.value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                this.updateQuickButtonStates();
            });
        });
    }

    setupPropertyInput(inputId, styleProperty, styles, activeDevice, type = 'text') {
        const input = this.app.querySelector(`#${inputId}`);
        input.value = styles[activeDevice][styleProperty] || '';
    const evt = type === 'select' ? 'change' : 'input';
    input.addEventListener(evt, (e) => {
            styles[activeDevice][styleProperty] = e.target.value;
            this.selectedElement.dataset.styles = JSON.stringify(styles);
            this.applyStyles();
            if (styleProperty === 'width' || styleProperty === 'height') {
                this.updateQuickButtonStates();
            }
        });
    }

    applyStyles() {
            this.preview.querySelectorAll('div[data-styles]').forEach(el => {
            const styles = JSON.parse(el.dataset.styles);
            const desktopStyles = styles.desktop;
            const tabletStyles = styles.tablet;
            const mobileStyles = styles.mobile;

            const activeDevice = this.getActiveDevice();
            const responsiveStack = el.dataset.responsiveStack === 'true';

            let finalStyles = {};

            if (activeDevice === 'desktop') {
                finalStyles = {...desktopStyles};
            } else if (activeDevice === 'tablet') {
                finalStyles = {...desktopStyles, ...tabletStyles};
                if (responsiveStack && el.classList.contains('row')) {
                    finalStyles.flexDirection = 'column';
                }
            } else {
                // Mobile view
                finalStyles = {...desktopStyles, ...tabletStyles, ...mobileStyles};
                if (responsiveStack && el.classList.contains('row')) {
                    finalStyles.flexDirection = 'column';
                }
            }

            const isRow = el.classList.contains('row');
            const isGridContainer = el.classList.contains('grid-container');
            const gridStack = el.dataset.gridStack === 'true';

            // Provide a stable default for row containers when flexDirection absent
            if (!finalStyles.flexDirection && el.classList.contains('row')) {
                finalStyles.flexDirection = ((activeDevice === 'tablet' || activeDevice === 'mobile') && responsiveStack) ? 'column' : 'row';
            }
            if (isGridContainer) {
                if (!finalStyles.display) finalStyles.display = 'grid';
                // Grid stacking: collapse to single column when enabled
                if (gridStack && (activeDevice === 'tablet' || activeDevice === 'mobile')) {
                    // Only force if no explicit template override for that device
                    const explicitTemplate = (activeDevice === 'tablet' && tabletStyles.gridTemplateColumns) || (activeDevice === 'mobile' && mobileStyles.gridTemplateColumns);
                    if (!explicitTemplate) {
                        finalStyles.gridTemplateColumns = '1fr';
                    }
                }
            }

            // Clear existing inline styles
            el.style.cssText = '';

            Object.keys(finalStyles).forEach(key => {
                el.style[key] = finalStyles[key];
            });
        });
    this.scheduleAutoGenerate();
    }

    updateQuickButtonStates() {
        // For each quick-values group, mark the button whose data-value matches input's value
        this.app.querySelectorAll('.property').forEach(prop => {
            const quick = prop.querySelector('.quick-values');
            if (!quick) return;
            const input = prop.querySelector('input');
            if (!input) return;
            const current = input.value.trim();
            quick.querySelectorAll('.quick-btn').forEach(btn => {
                if (btn.dataset.value === current) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });
    }

    getActiveDevice() {
        return this.currentDevice || 'desktop';
    }

    setActivePropertyDevice(device) {
        if (this.propertyEditDevice === device) return;
        this.propertyEditDevice = device;
        // Try fast path update; fallback to full rebuild if it fails
        if (!this.fastUpdatePropertyValues(device)) {
            // Defer rebuild to next frame for snappier tab highlight
            requestAnimationFrame(()=> this.updatePropertiesPanel());
        }
    }

    clearCanvas() {
        this.preview.innerHTML = '';
        this.selectedElement = null;
        this.updatePropertiesPanel();
    this.scheduleAutoGenerate();
    }

    loadPreset(preset) {
        this.clearCanvas();
        if (preset === 'header-content-footer') {
            this.preview.innerHTML = `
                <div class="row" data-styles='{"desktop":{"height":"100px","flexShrink":"0"},"tablet":{},"mobile":{}}' data-responsive-stack="false">Header</div>
                <div class="row" data-styles='{"desktop":{"flexGrow":"1"},"tablet":{},"mobile":{}}' data-responsive-stack="false">Content</div>
                <div class="row" data-styles='{"desktop":{"height":"100px","flexShrink":"0"},"tablet":{},"mobile":{}}' data-responsive-stack="false">Footer</div>`;
            this.preview.style.display = 'flex';
            this.preview.style.flexDirection = 'column';
            this.preview.style.height = '100%';
        } else if (preset === 'sidebar-layout') {
            this.preview.innerHTML = `
                <div class="row" data-styles='{"desktop":{"display":"flex","flexDirection":"row","flexGrow":"1"},"tablet":{},"mobile":{}}' data-responsive-stack="true">
                    <div class="col" data-styles='{"desktop":{"width":"200px","flexShrink":"0"},"tablet":{},"mobile":{}}' data-responsive-stack="false">Sidebar</div>
                    <div class="col" data-styles='{"desktop":{"flexGrow":"1"},"tablet":{},"mobile":{}}' data-responsive-stack="false">Main Content</div>
                </div>`;
            this.preview.style.display = '';
            this.preview.style.flexDirection = '';
            this.preview.style.height = '100%';
        } else if (preset === 'grid-2col-hero') {
            this.preview.innerHTML = `
                <div class="grid-container" data-styles='{"desktop":{"display":"grid","gridTemplateColumns":"1fr 1fr","gap":"24px"},"tablet":{},"mobile":{}}' data-responsive-stack="false">
                    <div class="grid-item" data-styles='{"desktop":{},"tablet":{},"mobile":{}}' data-responsive-stack="false">Left Panel</div>
                    <div class="grid-item" data-styles='{"desktop":{},"tablet":{},"mobile":{}}' data-responsive-stack="false">Right Panel</div>
                </div>`;
            this.preview.style.height = '100%';
        }
        this.applyStyles();
        this.scheduleAutoGenerate(true);
    }

    scheduleAutoGenerate(force = false) {
        const auto = this.app.querySelector('#auto-update-code');
        if (!auto || !auto.checked) return;
        if (force) {
            cancelAnimationFrame(this._autoGenRaf || 0);
            clearTimeout(this._autoGenTimer);
            this._autoGenTimer = setTimeout(() => this.generateCode(), 10);
            return;
        }
        // Debounce with micro idle window
        this._pendingAutoGen = true;
        cancelAnimationFrame(this._autoGenRaf || 0);
        this._autoGenRaf = requestAnimationFrame(() => {
            clearTimeout(this._autoGenTimer);
            this._autoGenTimer = setTimeout(() => {
                if (this._pendingAutoGen) {
                    this._pendingAutoGen = false;
                    this.generateCode();
                }
            }, 120);
        });
    }
}

new CSSEditor(document.getElementById('app'));