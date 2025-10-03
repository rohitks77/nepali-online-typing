(function(){
	'use strict';

	const input = document.getElementById('ro-input');
	const btnCopy = document.getElementById('btn-copy');
	const btnClear = document.getElementById('btn-clear');
	const btnSelect = document.getElementById('btn-select');
	const btnDownload = document.getElementById('btn-download');
	const charCount = document.getElementById('char-count');
	const toggleLayoutBtn = document.getElementById('toggle-layout');
	const fontIncBtn = document.getElementById('font-inc');
	const fontDecBtn = document.getElementById('font-dec');
	const heightIncBtn = document.getElementById('height-inc');
	const heightDecBtn = document.getElementById('height-dec');
	const resetBtn = document.getElementById('reset-defaults');
	const refToggleBtn = document.getElementById('toggle-ref');
	const refPanel = document.getElementById('ref-panel');
	const refInput = document.getElementById('ref-input');
	const refClear = document.getElementById('ref-clear');
	const refHelp = document.getElementById('ref-help');
	const modal = document.getElementById('ref-modal');
	const modalClose = document.getElementById('ref-modal-close');
	const modalOverlay = document.getElementById('modal-overlay');
	const refFontInc = document.getElementById('ref-font-inc');
	const refFontDec = document.getElementById('ref-font-dec');
	const refHeightInc = document.getElementById('ref-height-inc');
	const refHeightDec = document.getElementById('ref-height-dec');
	const toast = document.getElementById('toast');
	const appHelpBtn = document.getElementById('app-help');
	const appModal = document.getElementById('app-modal');
	const appModalClose = document.getElementById('app-modal-close');
	const shortcutModal = document.getElementById('shortcut-modal');
	const shortcutClose = document.getElementById('shortcut-close');
	const installBanner = document.getElementById('install-banner');
	const installBtn = document.getElementById('install-app');
	const installInfo = document.getElementById('install-info');
	const installModal = document.getElementById('install-modal');
	const installClose = document.getElementById('install-close');
	const installBannerClose = document.getElementById('install-banner-close');
	const INSTALL_HIDE_KEY = 'pwa.installBanner.hiddenUntil';
	const INSTALL_INSTALLED_KEY = 'pwa.installed';

	function isStandalone(){
		try {
			return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
		} catch(_) { return false; }
	}

	function shouldShowInstallBanner(){
		try {
			if (isStandalone()) return false;
			if (localStorage.getItem(INSTALL_INSTALLED_KEY) === '1') return false;
			const until = parseInt(localStorage.getItem(INSTALL_HIDE_KEY)||'0',10);
			return !until || Date.now() > until;
		} catch(_) { return true; }
	}
	let drag = { active:false, offsetX:0, offsetY:0 };
	const fullBtn = document.getElementById('toggle-full');

	const state = { prevUnicode:'', lastKey:'', fontSize:16, boxHeight:140, layoutVisible:true, refVisible:false, refFontSize:16, refBoxHeight:140 };

	// Load persisted settings
	try {
		const fs = parseInt(localStorage.getItem('ro.fontSize')||'16',10);
		if (!Number.isNaN(fs)) state.fontSize = Math.min(36, Math.max(12, fs));
		const bh = parseInt(localStorage.getItem('ro.boxHeight')||'140',10);
		if (!Number.isNaN(bh)) state.boxHeight = Math.min(480, Math.max(100, bh));
		const lv = localStorage.getItem('ro.layoutVisible');
		if (lv === '0') state.layoutVisible = false;
		const rfs = parseInt(localStorage.getItem('ro.refFontSize')||'16',10);
		if (!Number.isNaN(rfs)) state.refFontSize = Math.min(36, Math.max(12, rfs));
		const rbh = parseInt(localStorage.getItem('ro.refBoxHeight')||'140',10);
		if (!Number.isNaN(rbh)) state.refBoxHeight = Math.min(600, Math.max(100, rbh));
	} catch(_) {}

	function applyUiFromState(){
		if (input){
			input.style.fontSize = state.fontSize + 'px';
			input.style.minHeight = state.boxHeight + 'px';
		}
		const kbWrap = document.querySelector('.kb-wrap');
		if (kbWrap){ kbWrap.style.display = state.layoutVisible ? '' : 'none'; }
		if (toggleLayoutBtn){
			toggleLayoutBtn.textContent = state.layoutVisible ? 'Layout: On' : 'Layout: Off';
			toggleLayoutBtn.classList.toggle('active', state.layoutVisible);
		}
		if (refPanel){
			refPanel.style.display = state.refVisible ? '' : 'none';
			if (refInput){
				refInput.style.fontSize = state.refFontSize + 'px';
				refInput.style.minHeight = state.refBoxHeight + 'px';
			}
		}
		if (refToggleBtn){ refToggleBtn.textContent = state.refVisible ? 'Reference: Hide' : 'Reference: Show'; }
	}

	function applyFixes(text){
    // If no ASCII letters or ':' present, do not re-run transliteration
    // This prevents double handling when text is already Nepali
    const hasLatin = /[A-Za-z:]/.test(text || '');
    if (!hasLatin && text === state.prevUnicode) return text;
    if (!window.nepalify || !window.nepalify.format) return text;
		// Base transliteration
		let out = window.nepalify.format(text);

		// Removed visarga auto-add logic per request

		// Enforce c/C mapping similar to Nepali practice tool
		if (!state.prevUnicode) {
			if (state.lastKey === 'c') return out.replace(/छ/g, 'च');
			if (state.lastKey === 'C') return out.replace(/च/g, 'छ');
			return out;
		}

		if (out.length <= state.prevUnicode.length) {
			if (state.lastKey === 'c') return out.replace(/छ/g, 'च');
			if (state.lastKey === 'C') return out.replace(/च/g, 'छ');
			return out;
		}

		const prefix = out.slice(0, state.prevUnicode.length);
		let suffix = out.slice(state.prevUnicode.length);
		if (state.lastKey === 'c') suffix = suffix.replace(/छ/g, 'च');
		else if (state.lastKey === 'C') suffix = suffix.replace(/च/g, 'छ');
		return prefix + suffix;
	}

	function onInput(){
		const uni = applyFixes(input.value);
		if (input.value !== uni){
			input.value = uni;
			try { input.setSelectionRange(uni.length, uni.length); } catch(_) {}
		}
		state.prevUnicode = input.value;
		try { localStorage.setItem('ro.text', state.prevUnicode||''); } catch(_) {}
		if (charCount) charCount.textContent = (state.prevUnicode||'').length + ' chars';
		// Ensure mirrored scroll when a new line causes overflow
		if (refInput){ setTimeout(() => { syncScroll(input, refInput); }, 0); }
	}

	// Synchronized scrolling between main input and reference input
	let isSyncingFromMain = false;
	let isSyncingFromRef = false;
	function syncScroll(from, to){
		if (!from || !to) return;
		const fromMax = Math.max(1, from.scrollHeight - from.clientHeight);
		const toMax = Math.max(1, to.scrollHeight - to.clientHeight);
		const ratio = from.scrollTop / fromMax;
		to.scrollTop = Math.round(ratio * toMax);
	}
	if (input && refInput){
		input.addEventListener('scroll', () => {
			if (isSyncingFromRef) return;
			isSyncingFromMain = true;
			syncScroll(input, refInput);
			isSyncingFromMain = false;
		});
		// Intentionally do not mirror from reference → main per request
	}

	function onKeyDown(e){
		// Track last printable for c/C mapping
		if (typeof e.key === 'string' && e.key.length === 1) state.lastKey = e.key;
		else if (e.key === 'Backspace') state.lastKey = '';

		// Removed special handling for '|' and '\\' so they type literally
	}

	function insertAtCaret(s){
		const start = input.selectionStart || 0;
		const end = input.selectionEnd || 0;
		const before = input.value.slice(0, start);
		const after = input.value.slice(end);
		input.value = before + s + after;
		const idx = before.length + s.length;
		try { input.setSelectionRange(idx, idx); } catch(_) {}
		onInput();
	}

	function copyText(){
		try {
			navigator.clipboard.writeText(input.value);
			btnCopy.textContent = 'Copied!';
			setTimeout(()=> btnCopy.textContent='Copy', 1200);
		} catch(_) {
			// Fallback
			input.select();
			document.execCommand('copy');
		}
	}

	function clearText(){
		input.value='';
		state.prevUnicode='';
		state.lastKey='';
		input.focus();
		try { localStorage.setItem('ro.text',''); } catch(_) {}
		if (charCount) charCount.textContent = '0 chars';
	}

	if (input){
		input.addEventListener('input', onInput);
		input.addEventListener('keydown', onKeyDown);
	}
	if (btnCopy) btnCopy.addEventListener('click', copyText);
	if (btnClear) btnClear.addEventListener('click', clearText);
	if (btnSelect) btnSelect.addEventListener('click', () => { input.focus(); input.select(); });
	if (btnDownload) btnDownload.addEventListener('click', () => {
		const blob = new Blob([input.value||''], { type: 'text/plain;charset=utf-8' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'nepali-text.txt';
		a.click();
		setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
	});

	// UI controls
	if (toggleLayoutBtn) toggleLayoutBtn.addEventListener('click', () => {
		state.layoutVisible = !state.layoutVisible;
		try { localStorage.setItem('ro.layoutVisible', state.layoutVisible ? '1':'0'); } catch(_) {}
		applyUiFromState();
	});
	function setFontSize(sz){ state.fontSize = Math.min(36, Math.max(12, sz)); try { localStorage.setItem('ro.fontSize', String(state.fontSize)); } catch(_) {} applyUiFromState(); }
	if (fontIncBtn) fontIncBtn.addEventListener('click', () => setFontSize(state.fontSize + 2));
	if (fontDecBtn) fontDecBtn.addEventListener('click', () => setFontSize(state.fontSize - 2));
	function setBoxHeight(h){ state.boxHeight = Math.min(480, Math.max(100, h)); try { localStorage.setItem('ro.boxHeight', String(state.boxHeight)); } catch(_) {} applyUiFromState(); }
	if (heightIncBtn) heightIncBtn.addEventListener('click', () => setBoxHeight(state.boxHeight + 40));
	if (heightDecBtn) heightDecBtn.addEventListener('click', () => setBoxHeight(state.boxHeight - 40));
	if (resetBtn) resetBtn.addEventListener('click', () => {
		state.fontSize = 16;
		state.boxHeight = 140;
		state.layoutVisible = true;
		state.refVisible = false;
		state.refFontSize = 16;
		state.refBoxHeight = 140;
		try {
			localStorage.setItem('ro.fontSize','16');
			localStorage.setItem('ro.boxHeight','140');
			localStorage.setItem('ro.layoutVisible','1');
			localStorage.setItem('ro.refVisible','0');
			localStorage.setItem('ro.refFontSize','16');
			localStorage.setItem('ro.refBoxHeight','140');
		} catch(_) {}
		applyUiFromState();
		showToast('Defaults applied: layout on, sizes reset');
	});

	// Reference panel
	try {
		const rv = localStorage.getItem('ro.refVisible');
		if (rv === '1') state.refVisible = true;
		if (refInput){
			const saved = localStorage.getItem('ro.refText');
			if (saved) refInput.value = saved;
		}
	} catch(_) {}
	if (refToggleBtn) refToggleBtn.addEventListener('click', () => {
		state.refVisible = !state.refVisible;
		try { localStorage.setItem('ro.refVisible', state.refVisible ? '1':'0'); } catch(_) {}
		applyUiFromState();
	});
	if (refInput) refInput.addEventListener('input', () => { try { localStorage.setItem('ro.refText', refInput.value||''); } catch(_) {} });
	if (refClear) refClear.addEventListener('click', () => { if (refInput){ refInput.value=''; try { localStorage.setItem('ro.refText',''); } catch(_) {} refInput.focus(); } });
	// Reference sizing controls
	function setRefFontSize(sz){ state.refFontSize = Math.min(36, Math.max(12, sz)); try { localStorage.setItem('ro.refFontSize', String(state.refFontSize)); } catch(_) {} applyUiFromState(); }
	function setRefBoxHeight(h){ state.refBoxHeight = Math.min(600, Math.max(100, h)); try { localStorage.setItem('ro.refBoxHeight', String(state.refBoxHeight)); } catch(_) {} applyUiFromState(); }
	if (refFontInc) refFontInc.addEventListener('click', () => setRefFontSize(state.refFontSize + 2));
	if (refFontDec) refFontDec.addEventListener('click', () => setRefFontSize(state.refFontSize - 2));
	if (refHeightInc) refHeightInc.addEventListener('click', () => setRefBoxHeight(state.refBoxHeight + 40));
	if (refHeightDec) refHeightDec.addEventListener('click', () => setRefBoxHeight(state.refBoxHeight - 40));

	// Ensure nepalify is available; if not, try a fallback CDN and re-run conversion
	function ensureNepalify(){
		if (window.nepalify && window.nepalify.format) return;
		const already = document.querySelector('script[data-fallback-nepalify]');
		if (already) return; // avoid duplicate
		const s = document.createElement('script');
		s.src = 'https://cdn.jsdelivr.net/npm/nepalify@0.7.1/nepalify.min.js';
		s.async = true;
		s.setAttribute('data-fallback-nepalify','1');
		s.onload = () => { try { onInput(); } catch(_){} };
		document.head.appendChild(s);
	}

	ensureNepalify();
	applyUiFromState();

	// Register service worker for PWA/offline
	if ('serviceWorker' in navigator) {
		try {
			navigator.serviceWorker.register('./sw.js').then(() => {
				if (installBanner && shouldShowInstallBanner()) installBanner.style.display = '';
			});
		} catch(_) {}
	}

	// Fullscreen toggle
	function toggleFull(){
		try {
			if (!document.fullscreenElement) {
				document.documentElement.requestFullscreen();
				if (fullBtn) fullBtn.textContent = 'Exit Full';
			} else {
				document.exitFullscreen();
				if (fullBtn) fullBtn.textContent = 'Full Mode';
			}
		} catch(_) {}
	}
	if (fullBtn) fullBtn.addEventListener('click', toggleFull);
	document.addEventListener('fullscreenchange', () => { if (fullBtn) fullBtn.textContent = document.fullscreenElement ? 'Exit Full' : 'Full Mode'; });

	// Help modal handlers
	function centerModal(el){ if (!el) return; el.style.left='50%'; el.style.top='50%'; el.style.transform='translate(-50%,-50%)'; }
	function openModal(){ if (modal && modalOverlay){ centerModal(modal); modal.style.display='block'; modalOverlay.style.display='block'; } }
	function closeModal(){ if (modal && modalOverlay){ modal.style.display='none'; modalOverlay.style.display='none'; } }
	if (refHelp) refHelp.addEventListener('click', openModal);
	if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', () => { 
        closeModal(); 
        closeApp(); 
        if (typeof closeShortcuts === 'function') closeShortcuts(); 
        if (installModal) { installModal.style.display='none'; modalOverlay.style.display='none'; }
    });

	// App help modal
	function openApp(){ if (appModal && modalOverlay){ centerModal(appModal); appModal.style.display='block'; modalOverlay.style.display='block'; } }
	function closeApp(){ if (appModal && modalOverlay){ appModal.style.display='none'; modalOverlay.style.display='none'; } }
	if (appHelpBtn) appHelpBtn.addEventListener('click', openApp);
	if (appModalClose) appModalClose.addEventListener('click', closeApp);

	// Drag support for both modals via their headers
	function makeDraggable(modalId){
		const modalEl = document.getElementById(modalId);
		if (!modalEl) return;
		const header = modalEl.querySelector('.modal-header');
		if (!header) return;
		header.addEventListener('mousedown', (e) => {
			drag.active = true;
			const rect = modalEl.getBoundingClientRect();
			drag.offsetX = e.clientX - rect.left;
			drag.offsetY = e.clientY - rect.top;
			modalEl.style.left = rect.left + 'px';
			modalEl.style.top = rect.top + 'px';
			modalEl.style.transform = 'none';
			document.body.style.userSelect = 'none';
		});
		document.addEventListener('mousemove', (e) => {
			if (!drag.active) return;
			modalEl.style.left = (e.clientX - drag.offsetX) + 'px';
			modalEl.style.top = (e.clientY - drag.offsetY) + 'px';
		});
		document.addEventListener('mouseup', () => {
			drag.active = false;
			document.body.style.userSelect = '';
		});
	}

	makeDraggable('ref-modal');
	makeDraggable('app-modal');

	// Shortcut palette
	function openShortcuts(){ if (shortcutModal && modalOverlay){ centerModal(shortcutModal); shortcutModal.style.display='block'; modalOverlay.style.display='block'; } }
	function closeShortcuts(){ if (shortcutModal && modalOverlay){ shortcutModal.style.display='none'; modalOverlay.style.display='none'; } }
	if (shortcutClose) shortcutClose.addEventListener('click', closeShortcuts);
	makeDraggable('shortcut-modal');

	// Global keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		const ctrlOrCmd = e.ctrlKey || e.metaKey;
		if (ctrlOrCmd && e.key.toLowerCase() === 'k') { e.preventDefault(); openShortcuts(); return; }
		if (ctrlOrCmd && e.key.toLowerCase() === 'c') { e.preventDefault(); copyText(); return; }
		if (ctrlOrCmd && e.key.toLowerCase() === 'a') { e.preventDefault(); if (input){ input.focus(); input.select(); } return; }
		if (ctrlOrCmd && e.key === 'Backspace') { e.preventDefault(); clearText(); return; }
		if (ctrlOrCmd && (e.key === '+' || e.key === '=')) { e.preventDefault(); const btn = document.getElementById('font-inc'); if (btn) btn.click(); return; }
		if (ctrlOrCmd && (e.key === '-' || e.key === '_')) { e.preventDefault(); const btn = document.getElementById('font-dec'); if (btn) btn.click(); return; }
	});
	// Install prompt flow
	let deferredPrompt = null;
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e;
		if (installBtn) installBtn.disabled = false;
		if (installBanner && shouldShowInstallBanner()) installBanner.style.display = '';
	});

	window.addEventListener('appinstalled', () => {
		try { localStorage.setItem(INSTALL_INSTALLED_KEY, '1'); } catch(_) {}
		if (installBanner) installBanner.style.display = 'none';
	});
	function openInstall(){
		if (deferredPrompt) {
			deferredPrompt.prompt();
			deferredPrompt.userChoice.finally(() => { deferredPrompt = null; });
		} else {
			if (installModal && modalOverlay){ centerModal(installModal); installModal.style.display='block'; modalOverlay.style.display='block'; }
		}
	}
	if (installBtn){ installBtn.disabled = true; installBtn.addEventListener('click', openInstall); }
	if (installInfo){ installInfo.addEventListener('click', () => { if (installModal && modalOverlay){ centerModal(installModal); installModal.style.display='block'; modalOverlay.style.display='block'; } }); }
	if (installClose) installClose.addEventListener('click', () => { if (installModal && modalOverlay){ installModal.style.display='none'; modalOverlay.style.display='none'; } });
	if (installBannerClose && installBanner) installBannerClose.addEventListener('click', () => { 
		installBanner.style.display='none'; 
		try { localStorage.setItem(INSTALL_HIDE_KEY, String(Date.now() + 7*24*60*60*1000)); } catch(_) {}
	});

	function showToast(msg){
		if (!toast) return;
		toast.textContent = msg;
		toast.style.display = 'block';
		toast.classList.add('show');
		setTimeout(() => { toast.classList.remove('show'); setTimeout(()=> { toast.style.display='none'; }, 200); }, 1400);
	}
	// Load persisted text
	try {
		const saved = localStorage.getItem('ro.text');
		if (saved){ input.value = saved; state.prevUnicode = saved; if (charCount) charCount.textContent = saved.length + ' chars'; }
	} catch(_) {}

	// Do NOT attach Nepalify intercept; we manually control conversion to avoid double typing
})();


