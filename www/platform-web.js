/* ============================================================================
   platform-web.js — Electron नसताना (फोन/ब्राऊझरमध्ये) app.html चालवण्यासाठी "बनावट Electron".
   - require('electron').ipcRenderer चे आवश्यक संदेश (डेटा लोड/सेव्ह, प्रिंट, WhatsApp, link) हाताळतो.
   - डेटा IndexedDB मध्ये टिकतो (localStorage ची ५MB मर्यादा टाळण्यासाठी).
   - app.html चा मूळ कोड बदलावा लागत नाही: तो नेहमीप्रमाणे localStorage शिम वापरतो.
   ========================================================================== */
(function () {
  'use strict';
  var DB = 'gp-v2-data', ST = 'kv';
  var last = {};            // IndexedDB मध्ये सध्या असलेली मूल्ये (फक्त बदललेले लिहिण्यासाठी)
  var pending = null, wTimer = null, db = null;

  function openDb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function loadAll() {
    return new Promise(function (res, rej) {
      var out = {}, tx = db.transaction(ST, 'readonly'), c = tx.objectStore(ST).openCursor();
      c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); };
      c.onerror = function () { rej(c.error); };
    });
  }
  function flush() {
    if (!pending || !db) return;
    var store = pending; pending = null;
    var tx = db.transaction(ST, 'readwrite'), os = tx.objectStore(ST), k;
    for (k in store) if (store[k] !== last[k]) { os.put(store[k], k); last[k] = store[k]; }
    for (k in last) if (!(k in store) && k !== 'GP_MOBILE_ACT' && k !== 'GP_MOBILE_DEV') { os.delete(k); delete last[k]; }
  }
  function schedule(store) { pending = store; clearTimeout(wTimer); wTimer = setTimeout(flush, 250); }

  /* ----- Capacitor (Android APK) मदत: APK मध्ये Chrome नसतो, म्हणून link/प्रिंट/डाउनलोड नेटिव्ह प्लगिनमार्फत ----- */
  function cap() { var c = window.Capacitor; return (c && c.isNativePlatform && c.isNativePlatform()) ? c : null; }
  var plug = {};
  // APK मध्ये Capacitor चा JS भाग (core) आपण जोडलेला नाही; नेटिव्ह ब्रिजचा nativePromise(plugin, method, options) मात्र नेहमी असतो.
  function P(n) {
    var c = cap(); if (!c) return null;
    if (plug[n]) return plug[n];
    if (typeof c.registerPlugin === 'function') plug[n] = c.registerPlugin(n);
    else if (typeof c.nativePromise === 'function') {
      plug[n] = new Proxy({}, { get: function (_, m) {
        if (m === 'then') return undefined;
        return function (o) { return c.nativePromise(n, String(m), o || {}); };
      } });
    } else return null;
    return plug[n];
  }
  function openExternal(u) {
    var b = P('Browser');
    if (b) b.open({ url: u }); else window.open(u, '_blank', 'noopener');
  }
  function nativeSave(filename, blob) {          // फाईल → cache मध्ये लिहून Share/Save डायलॉग (Drive, WhatsApp, Files...)
    var FS = P('Filesystem'), SH = P('Share');
    var fr = new FileReader();
    fr.onload = function () {
      var b64 = String(fr.result).split(',')[1] || '';
      FS.writeFile({ path: filename, data: b64, directory: 'CACHE' })
        .then(function (r) { return SH.share({ title: filename, files: [r.uri], dialogTitle: 'फाईल सेव्ह / शेअर करा' }); })
        .catch(function (e) { try { window.showToast && window.showToast('⚠️ फाईल सेव्ह झाली नाही: ' + (e && e.message || e), 4000); } catch (x) {} });
    };
    fr.readAsDataURL(blob);
  }
  function interceptDownload(a) {
    var name = a.getAttribute('download') || 'file';
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (b) { nativeSave(name, b); });
  }
  function installDownloadHook() {
    function isDl(el) { return el && el.tagName === 'A' && el.hasAttribute('download') && /^(blob:|data:)/.test(el.href || ''); }
    var oc = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (isDl(this)) { interceptDownload(this); return; } return oc.apply(this, arguments); };
    var od = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (ev) { if (ev && ev.type === 'click' && isDl(this)) { interceptDownload(this); return true; } return od.apply(this, arguments); };
  }
  if (cap()) installDownloadHook();

  /* ----- ipcRenderer (बनावट) ----- */
  var L = {};
  var ipc = {
    on: function (ch, fn) { (L[ch] = L[ch] || []).push(fn); return ipc; },
    once: function (ch, fn) { var w = function () { ipc.removeListener(ch, w); fn.apply(null, arguments); }; w._o = fn; return ipc.on(ch, w); },
    removeListener: function (ch, fn) { L[ch] = (L[ch] || []).filter(function (f) { return f !== fn && f._o !== fn; }); return ipc; },
    emit: function (ch, payload) { setTimeout(function () { (L[ch] || []).slice().forEach(function (f) { try { f({}, payload); } catch (e) { console.error(e); } }); }, 0); },
    sendSync: function (ch, arg) {
      if (ch === 'gp-data-load') return window.__GP_DISK || {};
      if (ch === 'gp-data-save') { schedule(arg); return true; }
      return null;
    },
    send: function (ch, arg) {
      try {
        if (ch === 'open-external') { openExternal(arg); }
        else if (ch === 'open-whatsapp') {
          var n = String(arg || '').replace(/\D/g, '');
          if (n.length === 10) n = '91' + n;
          openExternal('https://wa.me/' + n);
        }
        else if (ch === 'print-html') webPrint(arg || {});
        else if (ch === 'capture-html-jpg') webCapture(arg || {});
        else if (ch === 'get-license-info') { /* मोबाईलवर लायसन्स नाही — काही पाठवत नाही */ }
      } catch (e) {
        console.error(e);
        if (ch === 'print-html') ipc.emit('print-error', { message: 'प्रिंट सुरू करता आले नाही: ' + (e && e.message || e) });
        else if (ch === 'capture-html-jpg') ipc.emit('capture-html-jpg-done', { ok: false });
      }
    }
  };

  /* ----- प्रिंट -----
     संगणकावर main.js (printToPDF) पान-आकार/मार्जिन ठरवतो, दाखला एका पानात बसवतो (zoom कमी करून) आणि नोंदवहीची पाने तळापर्यंत भरतो.
     फोनवर तेच काम इथे: छपाईच्या पानात एक स्क्रिप्ट जोडतो जी (१) @page चे आकार/मार्जिन संगणकाइतकेच ठेवते,
     (२) दाखला एका पानात बसेपर्यंत .doc/.cert-box चा zoom कमी करते, (३) नोंदवहीत रिकाम्या ओळी भरून प्रत्येक पान तळापर्यंत पूर्ण करते
     (src/reg-fill.js मधलेच gpRegFillPage वापरतो), (४) "पृष्ठ क्र. n / m" वरच्या कोपऱ्यात टाकते. */
  var REGFILL_SRC = "function gpRegFillPage(P) {\n  var wrap = document.getElementById('gp-reg-wrap');\n  if (!wrap) return { ok: false, why: 'no-wrap' };\n  var table = wrap.querySelector('table.reg-tbl');\n  if (!table) return { ok: false, why: 'no-table' };\n  var i;\n  // जुने भरणे (असल्यास) काढतो\n  var old = table.querySelectorAll('tbody.gp-fill');\n  for (i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);\n\n  // मुख्य टेबलनंतरचा सर्व भाग (बेरीज-टेबल, टीपा) एकाच अखंड ब्लॉकमध्ये ठेवतो — तो पानात मावला नाही तर\n  // संपूर्ण पुढच्या पानावर जातो (मध्येच तुटत नाही).\n  var tail = document.getElementById('gp-reg-tail');\n  if (!tail) {\n    var sibs = [];\n    for (var n = table.nextSibling; n; n = n.nextSibling) sibs.push(n);\n    if (sibs.length) {\n      tail = document.createElement('div');\n      tail.id = 'gp-reg-tail';\n      tail.style.cssText = 'display:flow-root;break-inside:avoid;page-break-inside:avoid';\n      table.parentNode.insertBefore(tail, table.nextSibling);\n      for (i = 0; i < sibs.length; i++) tail.appendChild(sibs[i]);\n    }\n  }\n  if (P.mode === 'clear') return { ok: true };\n\n  document.body.style.width = P.W + 'px'; // प्रत्यक्ष छपाईच्या रुंदीएवढ्या रुंदीवर मोजतो\n  try {\n    var thead = table.tHead;\n    function layout() {\n      var wr = wrap.getBoundingClientRect(), tr = table.getBoundingClientRect();\n      var items = [];\n      for (var k = 0; k < table.tBodies.length; k++) {\n        var b = table.tBodies[k];\n        items.push({ el: b, h: b.getBoundingClientRect().height, pin: b.classList.contains('reg-pin') });\n      }\n      return {\n        top: tr.top - wr.top,\n        thH: thead ? thead.getBoundingClientRect().height : 0,\n        items: items,\n        tailH: tail ? tail.getBoundingClientRect().height : 0,\n      };\n    }\n    // पान-विभागणीची नक्कल: प्रत्येक tbody (break-inside:avoid) बसत नसेल तर पुढच्या पानावर; heading प्रत्येक पानावर\n    function simulate(L, Hs) {\n      var y = L.top + L.thH, pageTop = y, pages = 1, gaps = [], firstPin = -1;\n      for (var k = 0; k < L.items.length; k++) {\n        var it = L.items[k];\n        if (y + it.h > Hs && y > pageTop + 0.5) {\n          gaps.push({ idx: k, gap: Hs - y });\n          pages++;\n          y = L.thH;\n          pageTop = L.thH;\n        }\n        if (it.pin && firstPin < 0) firstPin = k;\n        it.page = pages;\n        y += it.h;\n      }\n      var lastIdx = firstPin >= 0 ? firstPin : L.items.length;\n      var lastGap, tailPushed = false;\n      if (L.tailH > 0 && y + L.tailH > Hs) { tailPushed = true; lastGap = Hs - y; pages++; }\n      else lastGap = Hs - y - L.tailH;\n      return { pages: pages, gaps: gaps, last: { idx: lastIdx, gap: lastGap }, tailPushed: tailPushed, lastItemPage: L.items.length ? L.items[L.items.length - 1].page : 1 };\n    }\n\n    var L0 = layout();\n    var S0 = simulate(L0, P.H);\n    if (P.mode === 'prep') return { ok: true, p0: S0.pages };\n\n    // ── जागा वाटून देणे ──\n    // रिकाम्या ओळी न टाकता, प्रत्येक पानावरील नोंदींच्या (tbody) ओळींची उंची वाढवतो — म्हणजे त्या नोंदींचे border\n    // पानाच्या तळापर्यंत पोहोचतात. पानावर शिल्लक राहिलेली जागा त्या पानावरच्या नोंदींत समान वाटली जाते.\n    var Hs = P.H - P.safety;\n    var S = simulate(L0, Hs);\n    var pageGap = {};\n    for (i = 0; i < S.gaps.length; i++) {\n      // gaps[i] हे i-व्या पानाच्या (१-पासून) शेवटी उरलेली जागा\n      pageGap[i + 1] = S.gaps[i].gap;\n    }\n    // शेवटच्या पानावरच्या नोंदी आहेत तशाच (नैसर्गिक उंचीच्या) ठेवतो — फक्त आधीची पाने तळापर्यंत भरतो\n    var byPage = {};\n    for (i = 0; i < L0.items.length; i++) {\n      if (L0.items[i].pin) continue;\n      (byPage[L0.items[i].page] = byPage[L0.items[i].page] || []).push(L0.items[i]);\n    }\n    var jobs = [];\n    for (var pgNo in byPage) {\n      var gp = pageGap[pgNo];\n      if (!(gp >= P.minGap)) continue;\n      var list = byPage[pgNo], each = gp / list.length;\n      for (i = 0; i < list.length; i++) jobs.push({ it: list[i], target: list[i].h + each });\n    }\n    function setRows(tb, add) {\n      var rs = tb.rows, hs = [];\n      for (var a = 0; a < rs.length; a++) hs.push(rs[a].getBoundingClientRect().height);\n      for (a = 0; a < rs.length; a++) rs[a].style.height = (hs[a] + add / rs.length) + 'px';\n    }\n    for (i = 0; i < jobs.length; i++) setRows(jobs[i].it.el, jobs[i].target - jobs[i].it.h);\n    // प्रत्यक्ष उंची मोजून उरलेला फरक (border-collapse मुळे) पुन्हा समायोजित करतो\n    for (i = 0; i < jobs.length; i++) {\n      var d = jobs[i].target - jobs[i].it.el.getBoundingClientRect().height;\n      if (Math.abs(d) > 0.4) setRows(jobs[i].it.el, d);\n    }\n    var made = jobs;\n    var S2 = simulate(layout(), P.H);\n    return { ok: true, p0: S0.pages, p1: S2.pages, fills: made.length, tailPushed: S2.tailPushed,\n      dbg: P.debug ? { Hs: Hs, S: S, S2: S2 } : undefined };\n  } finally {\n    document.body.style.width = '';\n  }\n}";
  var PAGE_IN = { A4: [8.27, 11.69], Legal: [8.5, 14] };
  function printMargins(p) { return p.showPageNum ? { top: 0.45, bottom: 0.08, left: 0.04, right: 0.04 } : (p.fitOnePage ? { top: 0.03, bottom: 0.03, left: 0.03, right: 0.03 } : { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }); }
  function printArea(p) {
    var d = PAGE_IN[p.pageSize] || PAGE_IN.A4, m = printMargins(p), pw = p.landscape ? d[1] : d[0], ph = p.landscape ? d[0] : d[1];
    return { W: (pw - m.left - m.right) * 96, H: (ph - m.top - m.bottom) * 96, m: m, pw: pw, ph: ph };
  }
  function printPageScript(p) {
    var A = printArea(p), m = A.m;
    var css = '@page{size:' + (p.pageSize || 'A4') + (p.landscape ? ' landscape' : '') + ';margin:' + m.top + 'in ' + m.right + 'in ' + m.bottom + 'in ' + m.left + 'in;' +
      (p.showPageNum ? '@top-right{content:"पृष्ठ क्र. " counter(page) " / " counter(pages);font-size:8px;font-family:Arial,sans-serif;color:#333;padding-right:3mm}' : '') + '}';
    var cfg = JSON.stringify({ W: A.W, H: A.H, fit: !!p.fitOnePage, mz: p.maxZoom || 2.2, fill: !!p.fillPage, a4: (p.pageSize || 'A4') === 'A4', css: css });
    return '<script>(function(){var C=' + cfg + ';var FILL=' + JSON.stringify(REGFILL_SRC) + ';window.__gpReady=false;' +
      'function run(){try{' +
        'var st=document.createElement("style");st.textContent=C.css;(document.head||document.documentElement).appendChild(st);' +
        'if(C.fill){try{var f=new Function("return "+FILL)();var s=C.a4?24:16;var pr=f({mode:"prep",W:C.W,H:C.H});var r=pr&&pr.ok?f({mode:"fill",W:C.W,H:C.H,safety:s,rh:22,minGap:8}):null;window.__gpFill={prep:pr,fill:r};}catch(e){window.__gpFill={err:String(e)};}}' +
        'if(C.fit){var el=document.querySelector(".doc")||document.querySelector(".cert-box");' +
          'if(el){document.body.style.width=C.W+"px";var lim=C.H*0.97,lo=0.55,hi=C.mz;el.style.minHeight="0px";' +
            'for(var t=0;t<14;t++){var mid=(lo+hi)/2;el.style.zoom=mid;var h=el.getBoundingClientRect().height;if(h<=lim)lo=mid;else hi=mid;}' +
            'el.style.zoom=lo;el.style.minHeight=Math.floor((C.H*0.975)/lo)+"px";' +
            'document.body.style.width="";}}' +
      '}catch(e){}window.__gpReady=true;}' +
      'if(document.readyState==="complete")setTimeout(run,50);else window.addEventListener("load",function(){setTimeout(run,50);});' +
      '})();<\/script>';
  }
  function webPrint(p) {
    var html = String(p.html || '');
    var gp = P('GPPrint');
    var inj = printPageScript(p);
    if (gp) {                                      // Android APK: नेटिव्ह PrintManager ("Save as PDF" / प्रिंटर)
      html = html.indexOf('</body>') >= 0 ? html.replace('</body>', inj + '</body>') : html + inj;
      var settled = false;
      function fin(ev, payload) { if (settled) return; settled = true; clearTimeout(tm); ipc.emit(ev, payload); }
      // नेटिव्हकडून उत्तर आलेच नाही तरी "PDF तयार होत आहे" पट्टी कायमची अडकू नये
      var tm = setTimeout(function () { fin('print-error', { message: 'प्रिंट डायलॉग उघडला नाही — पुन्हा प्रयत्न करा (किंवा ॲप अपडेट करा)' }); }, 20000);
      gp.printHtml({ html: html, name: String(p.fileName || 'document').replace(/[^\w\u0900-\u097F.-]+/g, '_'), landscape: !!p.landscape, pageSize: p.pageSize || 'A4' })
        .then(function () { fin('print-done', {}); }, function (e) { fin('print-error', { message: 'प्रिंट सुरू झाले नाही: ' + (e && e.message || e) }); });
      return;
    }
    var auto = inj + '<script>window.addEventListener("load",function(){var n=0;(function w(){if(window.__gpReady||n++>40){try{window.focus();window.print();}catch(e){}}else setTimeout(w,150);})();});<\/script>';
    html = html.indexOf('</body>') >= 0 ? html.replace('</body>', auto + '</body>') : html + auto;
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    var win = window.open(url, '_blank');
    if (!win) { ipc.emit('print-error', { message: 'Popup block झाला — ब्राऊझरमध्ये या साईटला Popups ची परवानगी द्या' }); return; }
    setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    ipc.emit('print-done', {});
  }

  /* ----- पावती → JPG → क्लिपबोर्ड (WhatsApp मध्ये paste) — html2canvas असेल तरच ----- */
  function webCapture(p) {
    if (!window.html2canvas) { ipc.emit('capture-html-jpg-done', { ok: false }); return; }
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-99999px;top:0;border:0;width:' + (p.width || 700) + 'px;height:1200px';
    document.body.appendChild(f);
    var d = f.contentDocument; d.open(); d.write(p.html || ''); d.close();
    setTimeout(function () {
      window.html2canvas(d.body, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(function (cv) {
        cv.toBlob(function (blob) {
          document.body.removeChild(f);
          var done = function (ok) { ipc.emit('capture-html-jpg-done', { ok: ok }); };
          if (cap()) { nativeSave('Receipt-' + (p.ano || '') + '.png', blob); done(true); return; }   // APK: Share डायलॉगमधून WhatsApp निवडा
          try {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () { done(true); }, function () { fallbackShare(blob, p, done); });
          } catch (e) { fallbackShare(blob, p, done); }
        }, 'image/png');
      }).catch(function () { try { document.body.removeChild(f); } catch (e) {} ipc.emit('capture-html-jpg-done', { ok: false }); });
    }, 500);
  }
  function fallbackShare(blob, p, done) {
    try {
      var file = new File([blob], 'Receipt-' + (p.ano || '') + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).then(function () { done(true); }, function () { done(false); }); return; }
    } catch (e) {}
    done(false);
  }

  /* ----- वेबसाईट टेम्प्लेट (website-template/) चा वाचनापुरता "आभासी फाईल-फोल्डर" — वेबसाईट प्रकाशित करण्यासाठी ----- */
  function norm(p) {
    var parts = [], a = String(p).replace(/\\/g, '/').split('/');
    for (var i = 0; i < a.length; i++) { if (!a[i] || a[i] === '.') continue; if (a[i] === '..') parts.pop(); else parts.push(a[i]); }
    return '/' + parts.join('/');
  }
  var pathMod = {
    join: function () { return norm(Array.prototype.slice.call(arguments).join('/')); },
    dirname: function (p) { var n = norm(p).split('/'); n.pop(); return n.join('/') || '/'; },
    basename: function (p) { var n = norm(p).split('/'); return n.pop(); },
    resolve: function () { return norm(Array.prototype.slice.call(arguments).join('/')); }
  };
  function wt() { return window.__WT || {}; }
  function wtKey(p) { var n = norm(p), base = '/gp/website-template'; return n.indexOf(base) === 0 ? n.slice(base.length + 1) : null; }
  var noWrite = function () { throw new Error('प्रीव्ह्यू फक्त कॉम्प्युटरवर चालतो — मोबाईलवर "प्रकाशित करा" दाबून वेबसाईटची लिंक उघडा'); };
  var fsMod = {
    existsSync: function (p) { var k = wtKey(p); if (k === null) return false; if (k === '') return true; var f = wt(); if (f[k]) return true; return Object.keys(f).some(function (x) { return x.indexOf(k + '/') === 0; }); },
    readFileSync: function (p, enc) {
      var k = wtKey(p), e = k === null ? null : wt()[k];
      if (!e) throw new Error('फाईल सापडली नाही: ' + p);
      if (enc) return e.t !== undefined ? e.t : atob(e.b);
      return { toString: function (en) { return en === 'base64' ? (e.b !== undefined ? e.b : btoa(unescape(encodeURIComponent(e.t)))) : (e.t !== undefined ? e.t : atob(e.b)); } };
    },
    readdirSync: function (p) {
      var k = wtKey(p); if (k === null) return []; var pre = k ? k + '/' : '', seen = {};
      Object.keys(wt()).forEach(function (x) { if (x.indexOf(pre) === 0) seen[x.slice(pre.length).split('/')[0]] = 1; });
      return Object.keys(seen);
    },
    statSync: function (p) { var k = wtKey(p); return { isDirectory: function () { return k !== null && !wt()[k]; } }; },
    mkdirSync: noWrite, writeFileSync: noWrite
  };
  window.__dirname = '/gp/src';

  /* ----- 📱 मोबाईल ॲप लायसन्स (activation) -----
     Software Key + Mobile Code (desktop software मधून — Masters → मोबाईल ॲप लायसन्स) टाकल्याशिवाय ॲप उघडत नाही.
     Mobile Code = desktop license + Firebase Project ID वर Ed25519 सही. इथे फक्त public key आहे (सही तपासण्यासाठी);
     कोड बनवण्याची खाजगी key फक्त desktop software (main.js) मध्ये — म्हणून लायसन्स नसलेल्याला कोड बनवता येत नाही,
     आणि कोड Project ID शी बांधलेला असल्याने दुसऱ्या software/डेटावर चालत नाही. */
  var MOB_PUB = 'bTrU6BUAUKm81ctzLUPbpPmJ05ksTYwJYpaVKqPkxn4=';
  function b64d(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function normKey(k) { return String(k || '').toUpperCase().replace(/\s/g, ''); }
  // Device ID: या फोनचा स्वतःचा यादृच्छिक क्रमांक (पहिल्या वेळी बनतो, फोनवरच राहतो). Mobile Code याच ID शी बांधलेला असतो.
  var DEV_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newDeviceId() {
    var a = new Uint8Array(10), r = ''; (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 10; i++) r += DEV_ALPHA[a[i] % DEV_ALPHA.length];
    return r;
  }
  function deviceId() { return String((window.__GP_DISK || {}).GP_MOBILE_DEV || ''); }
  function fmtDev(d) { return d.slice(0, 5) + '-' + d.slice(5); }
  function verifyAct(key, code) {
    if (!window.nacl) return { ok: false, reason: 'lib' };
    var m = /^GPM2\.([a-z0-9-]{4,40})\.([A-Z2-9]{10})\.([A-Za-z0-9_-]{80,100})$/.exec(String(code || '').trim());
    if (!m) return { ok: false, reason: 'format' };
    var k = normKey(key);
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{6}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k)) return { ok: false, reason: 'key_format' };
    var good = false;
    try { good = window.nacl.sign.detached.verify(new TextEncoder().encode('GPMOB2|' + k + '|' + m[1] + '|' + m[2]), b64d(m[3]), b64d(MOB_PUB)); } catch (e) {}
    if (!good) return { ok: false, reason: 'bad' };
    if (m[2] !== deviceId()) return { ok: false, reason: 'other_device' };     // सही बरोबर, पण कोड दुसऱ्या फोनसाठी बनलेला
    return { ok: true, project: m[1], key: k, device: m[2] };
  }
  var act = null;   // सध्याची वैध activation: {ok, project, key}
  function loadAct() {
    act = null;
    try { var r = JSON.parse((window.__GP_DISK || {}).GP_MOBILE_ACT || 'null'); if (r && r.k && r.c) { var v = verifyAct(r.k, r.c); if (v.ok) act = v; } } catch (e) {}
    return act;
  }

  /* ----- बनावट require() ----- */
  window.require = function (name) {
    if (name === 'electron') return {
      ipcRenderer: ipc,
      shell: { openExternal: function (u) { openExternal(u); } },
      clipboard: { writeText: function (t) { try { var r = navigator.clipboard.writeText(t); if (r && r.catch) r.catch(function () {}); } catch (e) {} } }
    };
    if (name === 'qrcode') { if (window.QRCode) return window.QRCode; throw new Error('qrcode उपलब्ध नाही'); }
    if (/xlsx\.core\.min\.js$/.test(name)) { if (window.XLSX) return window.XLSX; throw new Error('XLSX उपलब्ध नाही'); }
    if (/jszip\.min\.js$/.test(name)) { if (window.JSZip) return window.JSZip; throw new Error('JSZip उपलब्ध नाही'); }
    if (name === 'path') return pathMod;
    if (name === 'fs') return fsMod;
    if (name === 'os') return { tmpdir: function () { return '/tmp'; } };
    throw new Error('"' + name + '" मोबाईल आवृत्तीत उपलब्ध नाही');
  };
  window.__GP_WEB = true;

  /* ----- बूट: IndexedDB मधून डेटा वाचून ठेवतो, मगच app उघडतो ----- */
  window.GPWeb = {
    boot: function () {
      return openDb().then(function (d) { db = d; return loadAll(); }).then(function (data) {
        last = {}; for (var k in data) last[k] = data[k];
        // मोबाईलवर स्थानिक login नाही — Cloud Sync चे Firebase खातेच प्रवेश
        if (!data.GP_USER) { data.GP_USER = JSON.stringify({ em: 'mobile', pw: '' }); }
        window.__GP_DISK = data;
        if (!/^[A-Z2-9]{10}$/.test(data.GP_MOBILE_DEV || '')) {          // या फोनचा Device ID (पहिल्यांदाच)
          data.GP_MOBILE_DEV = newDeviceId(); last.GP_MOBILE_DEV = data.GP_MOBILE_DEV;
          try { db.transaction(ST, 'readwrite').objectStore(ST).put(data.GP_MOBILE_DEV, 'GP_MOBILE_DEV'); } catch (e) {}
        }
        loadAct();
        // वेबसाईट टेम्प्लेट (build वेळी तयार केलेला website-template.json) — नसेल तरी ॲप चालते, फक्त वेबसाईट प्रकाशन चालणार नाही
        return fetch('website-template.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (t) { window.__WT = t; return data; });
      }).then(function (data) {
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
        return data;
      });
    },
    isActivated: function () { return !!act; },
    deviceId: deviceId,
    deviceIdPretty: function () { return fmtDev(deviceId()); },
    activation: function () { return act; },
    verify: verifyAct,
    activate: function (key, code) {
      var v = verifyAct(key, code); if (!v.ok) return v;
      var val = JSON.stringify({ k: v.key, c: String(code).trim() });
      window.__GP_DISK = window.__GP_DISK || {}; window.__GP_DISK.GP_MOBILE_ACT = val; last.GP_MOBILE_ACT = val;
      try { db.transaction(ST, 'readwrite').objectStore(ST).put(val, 'GP_MOBILE_ACT'); } catch (e) {}
      act = v; return v;
    },
    deactivate: function () {
      try { db.transaction(ST, 'readwrite').objectStore(ST).delete('GP_MOBILE_ACT'); } catch (e) {}
      delete last.GP_MOBILE_ACT; if (window.__GP_DISK) delete window.__GP_DISK.GP_MOBILE_ACT; act = null;
    },
    // Cloud Sync फक्त याच कोडशी बांधलेल्या Firebase Project शीच जोडता येतो — दुसऱ्या software चा डेटा/खाते चालत नाही
    projectAllowed: function (p) { return !!act && String(p || '').trim().toLowerCase() === act.project; },
    _flush: flush
  };
})();
