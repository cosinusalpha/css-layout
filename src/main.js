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
                </div>
                <button id="clear-btn">Clear Canvas</button>
                <div class="preset-container">
                    <label for="preset-select">Presets</label>
                    <select id="preset-select">
                        <option value="">Select a preset</option>
                        <option value="header-content-footer">Header, Content, Footer</option>
                        <option value="sidebar-layout">Sidebar Layout</option>
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
                <h2>Properties</h2>
                <div id="properties-panel-content">
                    <p>Select an element to edit its properties.</p>
                </div>
                <hr>
                <h2>Code</h2>
                <div id="code-panel-content">
                    <div class="code-format-container">
                        <label for="code-format-select">Format</label>
                        <select id="code-format-select">
                            <option value="css">Pure CSS</option>
                            <option value="tailwind">Tailwind CSS</option>
                        </select>
                    </div>
                    <button id="generate-code-btn">Generate Code</button>
                                        <button id="open-code-modal-btn">Open Large Viewer</button>
                    <pre id="html-code"></pre>
                    <pre id="css-code"></pre>
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

    this.selectedElement = null;
        this.preview.addEventListener('click', (e) => this.selectElement(e));
        this.app.querySelector('#generate-code-btn').addEventListener('click', () => this.generateCode());
    this.app.querySelector('#open-code-modal-btn').addEventListener('click', () => this.openCodeModal());
        this.app.querySelector('#clear-btn').addEventListener('click', () => this.clearCanvas());
        this.app.querySelector('#preset-select').addEventListener('change', (e) => this.loadPreset(e.target.value));
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
        const baseStyles = {
            desktop: {
                display: 'flex',
                flexDirection: type === 'row' ? 'row' : 'column',
                flexGrow: '1',
            },
            tablet: {},
            mobile: {}
        };
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
    }

    generateTailwind(element) {
        // Add base flex container to the root if it has children
        if (element.children.length > 0) {
            const rootClasses = ['flex'];
            // Detect if it's a column layout by checking first child
            const firstChild = element.children[0];
            if (firstChild && firstChild.classList.contains('row')) {
                rootClasses.push('flex-col');
            }
            element.className = rootClasses.join(' ');
        }

        element.querySelectorAll('*').forEach(el => {
            if (el.dataset.styles) {
                const styles = JSON.parse(el.dataset.styles);
                let classes = [];
                
                // Add base flex for containers with children
                if (el.children.length > 0) {
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
            display: { flex: 'flex', block: 'block', 'inline-block': 'inline-block', none: 'hidden' },
            flexDirection: { row: 'flex-row', column: 'flex-col' },
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
                const responsiveStack = el.dataset.responsiveStack === 'true';
            
            let css = '';
            for(const device in styles) {
                const deviceStyles = styles[device];
                    if (device === 'mobile' && responsiveStack && isRow && !('flexDirection' in deviceStyles)) {
                        deviceStyles.flexDirection = 'column';
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
                    <span>Stack children vertically on mobile</span>
                </label>
                <small style="color:#666;">Applies only below 376px width.</small>
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

    panelContent.innerHTML = `
            ${responsiveStackUI}
            <div class="property">
                                                <label>Width <span class="help-icon">?
                                                    <span class="tooltip-text">Width units:<br><strong>px</strong>: fixed pixels<br><strong>%</strong>: percent of parent<br><strong>em/rem</strong>: relative (rem = root)<br><strong>vw</strong>: legacy viewport width<br><strong>svw</strong>: small viewport width (stable, iOS safe)<br><strong>lvw</strong>: large viewport width<br><strong>dvw</strong>: dynamic viewport width</span>
                                </span></label>
                <div class="input-group">
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
                <div class="input-group">
                    <label style="display:block; width:100%; margin-top:8px; font-size:0.9rem; color:#555;">Height <span class="help-icon">?<span class="tooltip-text">Height units similar to width. svh/dvh handle mobile browser UI resizing more predictably.</span></span></label>
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
                <label>Layout Direction <span class="help-icon">?<span class="tooltip-text">Row = horizontal main axis; Column = vertical. Affects justify/align meaning.</span></span></label>
                <select id="flex-direction-select">
                    <option value="row">Horizontal (Row)</option>
                    <option value="column">Vertical (Column)</option>
                </select>
            </div>
            <div class="property">
                <label>Alignment <span class="help-icon">?<span class="tooltip-text">Justify controls distribution on main axis; Align controls cross-axis.</span></span></label>
                <div class="alignment-grid">
                    <div>
                        <label>Justify <span class="help-icon">?<span class="tooltip-text">Space along main axis (left/right for row, top/bottom for column).</span></span></label>
                        <select id="justify-content-select">
                            <option value="flex-start">Start</option>
                            <option value="center">Center</option>
                            <option value="flex-end">End</option>
                            <option value="space-between">Space Between</option>
                            <option value="space-around">Space Around</option>
                        </select>
                    </div>
                    <div>
                        <label>Align <span class="help-icon">?<span class="tooltip-text">Cross axis alignment (top, center, bottom, stretch).</span></span></label>
                        <select id="align-items-select">
                            <option value="stretch">Stretch</option>
                            <option value="flex-start">Start</option>
                            <option value="center">Center</option>
                            <option value="flex-end">End</option>
                        </select>
                    </div>
                </div>
            </div>
            ` : `
            <div class="property">
                <label>Flex Grow <span class="help-icon">?<span class="tooltip-text">Grow=1 lets the element expand to fill extra space; 0 keeps intrinsic width.</span></span></label>
                <select id="flex-grow-select">
                    <option value="">Auto</option>
                    <option value="0">No grow</option>
                    <option value="1">Grow to fill</option>
                </select>
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
            } else {
                // Mobile view
                finalStyles = {...desktopStyles, ...tabletStyles, ...mobileStyles};
                // Auto-apply responsive stacking for rows
                if (responsiveStack && el.classList.contains('row')) {
                    finalStyles.flexDirection = 'column';
                }
            }

            // Provide a stable default for row containers when flexDirection absent
            if (!finalStyles.flexDirection && el.classList.contains('row')) {
                finalStyles.flexDirection = (activeDevice === 'mobile' && responsiveStack) ? 'column' : 'row';
            }

            // Clear existing inline styles
            el.style.cssText = '';

            Object.keys(finalStyles).forEach(key => {
                el.style[key] = finalStyles[key];
            });
        });
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
        if (this.propertyEditDevice === device) return; // Avoid unnecessary re-renders
        this.propertyEditDevice = device;
        this.updatePropertiesPanel();
    }

    clearCanvas() {
        this.preview.innerHTML = '';
        this.selectedElement = null;
        this.updatePropertiesPanel();
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
        }
        this.applyStyles();
    }
}

new CSSEditor(document.getElementById('app'));