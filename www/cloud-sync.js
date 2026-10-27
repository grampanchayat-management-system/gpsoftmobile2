/* ============================================================================
   cloud-sync.js — संगणक + मोबाईल यांचा डेटा Firebase (Firestore) द्वारे एकसारखा ठेवतो.
   - Firebase SDK लागत नाही: फक्त REST (fetch) वापरतो, त्यामुळे Electron व मोबाईल दोन्हीकडे तोच कोड चालतो.
   - localStorage शिम (app.html) प्रत्येक बदलाचे वेळी GPSync.onSet() ला कळवतो; इथे "कोणती नोंद बदलली"
     ते शोधून (नमुना ८/९/१०, जन्म, मृत्यू... प्रत्येक नोंद वेगळी) फक्त तेवढीच क्लाउडवर पाठवली जाते.
   - दर ~१० सेकंदाला (व परत ऑनलाईन/ॲप उघडल्यावर) क्लाउडवरचे नवे बदल खाली घेतले जातात.
   - एकाच नोंदीत दोन्हीकडे बदल झाले तर नंतरचा (वेळेने) जिंकतो; हरलेली प्रत "conflict" यादीत जपली जाते.
   - अनुक्रमांक (GP_COUNTERS) दोन्हीकडचा जास्तीत जास्त घेतला जातो.
   ========================================================================== */
(function () {
  'use strict';
  if (window.GPSync) return;

  var SKIP = { GP_USER: 1, GP_CLOUD_Q: 1, GP_LAST_BACKUP: 1, GP_CERT_CACHE: 1,
               GP_SYNC_CFG: 1, GP_SYNC_META: 1, GP_printlog_seeded: 1, GP_MOBILE_ACT: 1, GP_MOBILE_DEV: 1 };
  var RECMAP = { GP_n8: 1, GP_n9: 1, GP_n10: 1, GP_birth: 1, GP_death: 1, GP_vivah: 1,
                 GP_bpl: 1, GP_nodue: 1, GP_niradhar: 1,
                 GP_printlog: 1,
                 GP_WEBSITE: 1 };       // वेबसाईट-मजकूर + GitHub user/repo/token: प्रत्येक विभाग (github, home, gallery...) वेगळी नोंद म्हणून      // प्रिंट-नोंद ("दिलेले दाखले" संख्या) — प्रत्येक नोंदीचा स्वतःचा अद्वितीय ID, म्हणून दोन्हीकडच्या नोंदी बेमालूम एकत्र होतात
  var WHOLE = '~';
  var CHUNK = 700000;
  var COMMIT_MAX = 150;
  var POLL_MS = 10000;
  var DEF_URLS = { fs: 'https://firestore.googleapis.com/v1',
                   idt: 'https://identitytoolkit.googleapis.com/v1',
                   tok: 'https://securetoken.googleapis.com/v1' };

  var ERRMAP = {
    EMAIL_NOT_FOUND: 'हा Email सापडला नाही (Firebase → Authentication मध्ये user बनवला आहे का?)',
    INVALID_PASSWORD: 'Password चुकीचा आहे',
    INVALID_LOGIN_CREDENTIALS: 'Email किंवा Password चुकीचा आहे',
    USER_DISABLED: 'हे खाते बंद केले आहे',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'खूप वेळा प्रयत्न झाले — थोड्या वेळाने पुन्हा करा',
    API_KEY_INVALID: 'Web API key चुकीची आहे',
    OPERATION_NOT_ALLOWED: 'Firebase → Authentication मध्ये "Email/Password" sign-in चालू करा',
    PERMISSION_DENIED: 'परवानगी नाही — Firestore Rules (FIREBASE-SYNC-SETUP.md) Publish केले आहेत का?',
    INVALID_REFRESH_TOKEN: 'पुन्हा Sign in करा', TOKEN_EXPIRED: 'पुन्हा Sign in करा'
  };

  // cfg/meta ला localStorage शिम तयार झाल्यावरच (lazy) वाचतो — हा स्क्रिप्ट शिमच्या आधी लोड होऊ शकतो
  var cfg = {}, meta = { t: {}, out: {}, cur: '', conf: [] }, loaded = false;
  function ensureLoaded() {
    if (loaded) return; loaded = true;
    cfg = loadJ('GP_SYNC_CFG') || {};
    meta = loadJ('GP_SYNC_META') || {};
    meta.t = meta.t || {}; meta.out = meta.out || {}; meta.cur = meta.cur || ''; meta.conf = meta.conf || []; meta.rv = meta.rv || {}; meta.v = meta.v || 1;
  }
  var applying = false, busy = false, status = { s: 'off', m: '' }, lastOk = 0;
  var saveTimer = null, pushTimer = null, ui = {};

  /* ---------- helpers ---------- */
  function ls() { return window.localStorage; }
  function loadJ(k) { try { return JSON.parse(ls().getItem(k) || 'null'); } catch (e) { return null; } }
  function pj(s) { if (s == null) return undefined; try { return JSON.parse(s); } catch (e) { return undefined; } }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function urls() { var u = cfg.urls || {}; return { fs: u.fs || DEF_URLS.fs, idt: u.idt || DEF_URLS.idt, tok: u.tok || DEF_URLS.tok }; }
  function isOn() { ensureLoaded(); return !!(cfg.on && cfg.uid && cfg.rt && cfg.p && cfg.k); }
  function saveCfg() { try { ls().setItem('GP_SYNC_CFG', JSON.stringify(cfg)); } catch (e) {} }
  function saveMeta(now) {
    if (now) { clearTimeout(saveTimer); try { ls().setItem('GP_SYNC_META', JSON.stringify(meta)); } catch (e) {} return; }
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; try { ls().setItem('GP_SYNC_META', JSON.stringify(meta)); } catch (e) {} }, 400);
  }
  function b64u(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function normTs(s) {
    var m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z$/.exec(String(s || ''));
    if (!m) return String(s || '');
    return m[1] + '.' + (m[2] || '').padEnd(9, '0').slice(0, 9) + 'Z';
  }
  function fv(f) {
    if (!f) return undefined;
    if ('stringValue' in f) return f.stringValue;
    if ('integerValue' in f) return Number(f.integerValue);
    if ('booleanValue' in f) return f.booleanValue;
    if ('timestampValue' in f) return f.timestampValue;
    return undefined;
  }
  function deepMax(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (isObj(a) && isObj(b)) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = (k in a) ? deepMax(a[k], b[k]) : b[k]; return o; }
    return b;
  }
  function toast(m) { try { if (window.showToast) window.showToast(m, 3500); } catch (e) {} }
  function setStatus(s, m) { status = { s: s, m: m || '' }; paint(); emitStatus(); }
  function errMsg(e) {
    var c = (e && (e.code || e.message)) || 'ERROR';
    c = String(c).split(' : ')[0];
    if (/API key not valid/i.test(String(e && e.message))) c = 'API_KEY_INVALID';
    return ERRMAP[c] || (/Failed to fetch|NetworkError|Load failed/i.test(String(e && e.message)) ? 'इंटरनेट नाही' : String(e && e.message || c));
  }
  function rawSet(k, v) { applying = true; try { if (window.__gpRaw) window.__gpRaw.set(k, v); else ls().setItem(k, v); } finally { applying = false; } }
  function rawDel(k) { applying = true; try { if (window.__gpRaw) window.__gpRaw.del(k); else ls().removeItem(k); } finally { applying = false; } }
  function syncable(k) { return k && k.indexOf('GP_') === 0 && !SKIP[k] && k.indexOf('GP_SYNC') !== 0; }

  /* ---------- Firebase REST ---------- */
  function http(method, url, body, headers, isForm) {
    var h = headers || {};
    var opt = { method: method, headers: h };
    if (body != null) { if (isForm) { h['Content-Type'] = 'application/x-www-form-urlencoded'; opt.body = body; } else { h['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); } }
    return fetch(url, opt).then(function (r) {
      return r.text().then(function (tx) {
        var j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) {}
        if (!r.ok) {
          var er = (j && (j.error || (Array.isArray(j) && j[0] && j[0].error))) || {};
          var e = new Error(er.message || ('HTTP ' + r.status));
          e.code = er.status || (er.message ? String(er.message).split(' ')[0] : 'HTTP_' + r.status); e.http = r.status; throw e;
        }
        return j;
      });
    });
  }
  function signIn(p, k, email, pw, first, customUrls) {
    ensureLoaded();
    // मोबाईल ॲप: Mobile Code ज्या Firebase Project साठी बनला त्याच Project शीच Sync जोडता येतो
    if (window.GPWeb && window.GPWeb.projectAllowed && !window.GPWeb.projectAllowed(p)) {
      var pe = Object.assign(new Error('हा Mobile Code दुसऱ्या Firebase Project साठी आहे — तुमच्या software मधील Project ID च वापरा'), { code: 'PROJECT_MISMATCH' });
      setStatus('err', pe.message); return Promise.reject(pe);
    }
    var c = { p: String(p || '').trim(), k: String(k || '').trim(), urls: customUrls || cfg.urls };
    var U = { idt: (c.urls && c.urls.idt) || DEF_URLS.idt };
    setStatus('wait', 'Sign in होत आहे…');
    return http('POST', U.idt + '/accounts:signInWithPassword?key=' + encodeURIComponent(c.k),
                { email: String(email || '').trim(), password: pw, returnSecureToken: true })
      .then(function (r) {
        cfg = { on: true, p: c.p, k: c.k, email: String(email).trim(), uid: r.localId, rt: r.refreshToken,
                idt: r.idToken, exp: Date.now() + Number(r.expiresIn || 3600) * 1000, first: first || 'down', urls: c.urls };
        saveCfg();
        scanLocal(cfg.first === 'up');
        saveMeta(true);
        start();
        return cycle();
      }, function (e) { setStatus('err', errMsg(e)); throw e; });
  }
  function token() {
    if (cfg.idt && Date.now() < (cfg.exp || 0) - 60000) return Promise.resolve(cfg.idt);
    if (!cfg.rt) return Promise.reject(Object.assign(new Error('Sign in आवश्यक'), { code: 'TOKEN_EXPIRED' }));
    return http('POST', urls().tok + '/token?key=' + encodeURIComponent(cfg.k),
                'grant_type=refresh_token&refresh_token=' + encodeURIComponent(cfg.rt), null, true)
      .then(function (r) {
        cfg.idt = r.id_token; cfg.rt = r.refresh_token || cfg.rt; cfg.exp = Date.now() + Number(r.expires_in || 3600) * 1000;
        saveCfg(); return cfg.idt;
      }, function (e) { if (e.http === 400) { cfg.rt = ''; saveCfg(); e.code = 'TOKEN_EXPIRED'; } throw e; });
  }
  function root() { return 'projects/' + cfg.p + '/databases/(default)/documents'; }
  function parent() { return root() + '/gpsync/' + cfg.uid; }
  function fsCall(path, body) {
    return token().then(function (t) { return http('POST', urls().fs + '/' + path, body, { Authorization: 'Bearer ' + t }); });
  }

  /* ---------- local change tracking ---------- */
  function readLocal(k, id) {
    var v = ls().getItem(k);
    if (id === WHOLE) return v == null ? null : v;
    var m = pj(v); if (!isObj(m) || !(id in m)) return null;
    return JSON.stringify(m[id]);
  }
  function mark(k, id, t, init) {
    var dk = k + '|' + id, prev = meta.out[dk];
    meta.t[dk] = t;
    meta.out[dk] = { k: k, i: id, r: ((prev && prev.r) || 0) + 1, init: !!init };
    saveMeta();
  }
  function onSet(key, oldV, newV) {
    if (!isOn() || applying || !syncable(key)) return;
    var now = Date.now(), changed = false;
    if (RECMAP[key]) {
      var o = pj(oldV), n = pj(newV); if (!isObj(o)) o = {}; if (!isObj(n)) n = {};
      var ids = {}, i; for (i in o) ids[i] = 1; for (i in n) ids[i] = 1;
      for (i in ids) {
        var a = (i in o) ? JSON.stringify(o[i]) : undefined, b = (i in n) ? JSON.stringify(n[i]) : undefined;
        if (a !== b) { mark(key, i, now, false); changed = true; }
      }
    } else if (oldV !== newV) { mark(key, WHOLE, now, false); changed = true; }
    if (changed) schedulePush();
  }
  function onRemove(key, oldV) { onSet(key, oldV, null); }
  function onClear(keys) { (keys || []).forEach(function (k) { onSet(k, ls().getItem(k), null); }); }
  function scanLocal(localWins) {
    var now = Date.now(), n = ls().length, keys = [], i;
    for (i = 0; i < n; i++) { var k = ls().key(i); if (syncable(k)) keys.push(k); }
    keys.forEach(function (k) {
      if (RECMAP[k]) {
        var m = pj(ls().getItem(k)); if (!isObj(m)) return;
        Object.keys(m).forEach(function (id) { if (meta.t[k + '|' + id] === undefined) mark(k, id, now, !localWins); });
      } else if (meta.t[k + '|' + WHOLE] === undefined) mark(k, WHOLE, now, !localWins);
    });
    meta.scanned = true; meta.v = 3;
  }

  /* ---------- push ---------- */
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(function () { cycle().catch(function () {}); }, 1500); }   // नेट नसेल तर शांतपणे थांबतो
  function docWrites(e, dk) {
    var val = readLocal(e.k, e.i), t = meta.t[dk] || Date.now(), name = parent() + '/rec/' + b64u(dk);
    var del = val == null, v = del ? '' : val, parts = [];
    for (var p = 0; p < v.length; p += CHUNK) parts.push(v.slice(p, p + CHUNK));
    if (!parts.length) parts.push('');
    var f = { dk: { stringValue: dk }, k: { stringValue: e.k }, i: { stringValue: e.i }, t: { integerValue: String(t) },
              d: { booleanValue: del }, n: { integerValue: String(parts.length) }, v: { stringValue: parts[0] } };
    var ws = [{ update: { name: name, fields: f }, updateTransforms: [{ fieldPath: 'st', setToServerValue: 'REQUEST_TIME' }],
                currentDocument: meta.rv[dk] ? { updateTime: meta.rv[dk] } : { exists: false } }];   // दुसऱ्या डिव्हाइसने मधेच बदल केला असेल तर लिहू नको
    for (var j = 1; j < parts.length; j++) ws.push({ update: { name: name + '.c' + j, fields: { v: { stringValue: parts[j] } } } });
    return ws;
  }
  function push(attempt) {
    attempt = attempt || 0;
    var dks = Object.keys(meta.out); if (!dks.length) return Promise.resolve(0);
    // एका commit मध्ये जास्तीत जास्त ~३०० writes आणि ~५MB (Firestore मर्यादा: ५०० writes, १०MB) — मोठे फोटो/PDF असलेल्या नोंदींसाठी
    var batch = [], writes = [], sent = {}, heads = [], bytes = 0, i;
    for (i = 0; i < dks.length && batch.length < COMMIT_MAX; i++) {
      var dk = dks[i], e = meta.out[dk], ws = docWrites(e, dk), sz = 0;
      ws.forEach(function (w) { sz += JSON.stringify(w).length; });
      if (batch.length && (writes.length + ws.length > 300 || bytes + sz > 5000000)) break;
      batch.push(dk); sent[dk] = e.r; heads.push({ dk: dk, idx: writes.length }); writes = writes.concat(ws); bytes += sz;
    }
    return fsCall(root() + ':commit', { writes: writes }).then(function (resp) {
      var wr = (resp && resp.writeResults) || [];
      heads.forEach(function (h) { if (wr[h.idx] && wr[h.idx].updateTime) meta.rv[h.dk] = wr[h.idx].updateTime; });
      batch.forEach(function (dk) { if (meta.out[dk] && meta.out[dk].r === sent[dk]) delete meta.out[dk]; });
      saveMeta();
      return Object.keys(meta.out).length ? push(0).then(function (n) { return n + batch.length; }) : batch.length;
    }, function (e) {
      var clash = e.http === 409 || /FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(String(e.code));
      if (!clash || attempt >= 4) throw e;
      return refreshHeads(batch).then(function () { return push(attempt + 1); });   // आधी क्लाउडची सध्याची आवृत्ती घेऊन निर्णय, मग पुन्हा पाठव
    });
  }
  function refreshHeads(dks) {
    var names = dks.map(function (dk) { return parent() + '/rec/' + b64u(dk); });
    return fsCall(root() + ':batchGet', { documents: names }).then(function (arr) {
      var recs = [], found = {};
      (arr || []).forEach(function (x) { if (x.found) { var r = docToRec(x.found); r.ut = x.found.updateTime; recs.push(r); found[r.dk] = 1; } });
      dks.forEach(function (dk) { if (!found[dk]) delete meta.rv[dk]; });
      return fetchParts(recs.filter(function (r) { return r.n > 1; })).then(function () {
        applyAll(recs.filter(function (r) { return !r.broken; })); saveMeta();
      });
    });
  }

  /* ---------- pull ---------- */
  function docToRec(d) {
    var f = d.fields || {};
    return { name: d.name, dk: fv(f.dk), k: fv(f.k), i: fv(f.i), t: fv(f.t) || 0, d: !!fv(f.d), n: fv(f.n) || 1,
             v: fv(f.v) || '', st: normTs(fv(f.st)), ut: d.updateTime };
  }
  function fetchParts(recs) {
    var need = [];
    recs.forEach(function (r) { if (r.n > 1) for (var j = 1; j < r.n; j++) need.push(r.name + '.c' + j); });
    if (!need.length) return Promise.resolve();
    return fsCall(root() + ':batchGet', { documents: need }).then(function (arr) {
      var got = {};
      (arr || []).forEach(function (x) { if (x.found) got[x.found.name] = fv((x.found.fields || {}).v) || ''; });
      recs.forEach(function (r) {
        if (r.n > 1) { for (var j = 1; j < r.n; j++) { var p = got[r.name + '.c' + j]; if (p === undefined) { r.broken = true; break; } r.v += p; } }
      });
    });
  }
  function queryPage(cur, op, limit) {
    var q = { from: [{ collectionId: 'rec' }], orderBy: [{ field: { fieldPath: 'st' }, direction: 'ASCENDING' }], limit: limit };
    if (cur) q.where = { fieldFilter: { field: { fieldPath: 'st' }, op: op, value: { timestampValue: cur } } };
    return fsCall(parent() + ':runQuery', { structuredQuery: q }).then(function (arr) {
      return (arr || []).filter(function (x) { return x.document; }).map(function (x) { return docToRec(x.document); });
    });
  }
  function pull() {
    var all = [], cur = meta.cur, op = 'GREATER_THAN', limit = 300;
    function next() {
      return queryPage(cur, op, limit).then(function (recs) {
        all = all.concat(recs);
        if (recs.length >= limit) { cur = recs[recs.length - 1].st; op = 'GREATER_THAN_OR_EQUAL'; limit = Math.min(limit * 2, 5000); return next(); }
      });
    }
    return next().then(function () {
      return fetchParts(all.filter(function (r) { return r.n > 1; }));
    }).then(function () {
      var maxSt = meta.cur || '';
      all.forEach(function (r) { if (r.st > maxSt) maxSt = r.st; });
      var n = applyAll(all.filter(function (r) { return !r.broken; }));
      if (!all.some(function (r) { return r.broken; })) meta.cur = maxSt;
      saveMeta();
      return n;
    });
  }
  function logConflict(dk, localVal) {
    meta.conf.push({ at: new Date().toISOString(), dk: dk, local: localVal == null ? null : String(localVal).slice(0, 20000) });
    if (meta.conf.length > 30) meta.conf = meta.conf.slice(-30);
  }
  function applyAll(recs) {
    var byKey = {}, count = 0, conflicts = 0;
    recs.forEach(function (r) {
      if (!r.dk || !syncable(r.k)) return;
      if (r.ut) meta.rv[r.dk] = r.ut;
      var lt = meta.t[r.dk], pend = meta.out[r.dk];
      if (r.k === 'GP_COUNTERS') { (byKey[r.k] = byKey[r.k] || []).push(r); return; }   // अनुक्रमांक: कधीच "नंतरचा जिंकतो" नाही — नेहमी जास्तीत जास्त
      if (pend) {
        var localVal = readLocal(r.k, r.i);
        if (!r.d && localVal === r.v) { delete meta.out[r.dk]; meta.t[r.dk] = r.t; return; }
        if (!pend.init && lt >= r.t) {                  // इथला बदल नवा — तोच क्लाउडवर जाईल; क्लाउडची हरलेली प्रत जपतो
          logConflict('☁️ ' + r.dk, r.d ? null : r.v); conflicts++; return;
        }
        logConflict(r.dk, localVal); conflicts++;        // क्लाउडवरचा नवा/अधिकृत — इथली प्रत जपून ठेवली
        delete meta.out[r.dk];
      } else if (lt !== undefined && lt >= r.t) return;   // ही आवृत्ती आधीच आहे
      (byKey[r.k] = byKey[r.k] || []).push(r);
    });
    Object.keys(byKey).forEach(function (k) { count += applyKey(k, byKey[k]); });
    if (conflicts) toast('⚠️ ' + conflicts + ' नोंदीत दोन्हीकडे बदल झाला — नंतरचा ठेवला (Sync पॅनेल पहा)');
    if (count) afterApply(Object.keys(byKey), count);
    return count;
  }
  function applyKey(k, recs) {
    recs.sort(function (a, b) { return a.t - b.t; });
    if (RECMAP[k]) {
      var map = pj(ls().getItem(k)); if (!isObj(map)) map = {};
      recs.forEach(function (r) {
        if (r.d) delete map[r.i]; else { var o = pj(r.v); if (o !== undefined) map[r.i] = o; }
        meta.t[r.dk] = r.t;
      });
      rawSet(k, JSON.stringify(map));
    } else {
      var r = recs[recs.length - 1];
      if (r.d) rawDel(k);
      else {
        var val = r.v;
        if (k === 'GP_COUNTERS') {
          var loc = pj(ls().getItem(k)), rem = pj(r.v);
          if (!isObj(loc)) loc = {};
          if (isObj(rem)) {
            var mg = deepMax(loc, rem); val = JSON.stringify(mg);
            if (val !== r.v) mark(k, WHOLE, Date.now(), false);   // इथला मोठा आकडा क्लाउडवरही पाठवायचा
            else delete meta.out[r.dk];
            try { if (window.counters && typeof window.counters === 'object') { var m2 = deepMax(window.counters, mg), kk; for (kk in m2) window.counters[kk] = m2[kk]; } } catch (e) {}
          }
        }
        rawSet(k, val);
      }
      recs.forEach(function (x) { meta.t[x.dk] = x.t; });
    }
    return recs.length;
  }
  // आता स्क्रीनवर दिसत असलेली यादी असेल तरच ती पुन्हा भरतो (फॉर्म/टाईप करत असलेले काहीही बदलत नाही)
  function refreshVisibleLists() {
    var map = [['pg-n8-list-pg', 'loadN8List'], ['n9-list', 'loadN9List'], ['n10-list', 'loadN10List'], ['birth-list', 'loadBirthList'],
               ['death-list', 'loadDeathList'], ['vivah-list', 'loadVivahList'], ['bpl-list', 'loadBPLList'], ['nd-list', 'loadNoDueList'],
               ['nr-list', 'loadNiradharList'], ['n12-tbl', 'loadN12List']];
    map.forEach(function (m) {
      try { var el = document.getElementById(m[0]); if (el && el.offsetParent !== null && window[m[1]]) window[m[1]](); } catch (e) {}
    });
  }
  function afterApply(keys, count) {
    toast('☁️ क्लाउडवरून ' + count + ' नवे बदल आले');
    try { window.dispatchEvent(new CustomEvent('gpsync-applied', { detail: { keys: keys, count: count } })); } catch (e) {}
    try {
      if (keys.indexOf('GP_COUNTERS') >= 0 && window.refreshIds && !window.n8EditMode && !window.n10EditMode) window.refreshIds();
      if (keys.indexOf('GP_WEBSITE') >= 0 && window.loadWebsiteForm) {                     // Website tab मधील GitHub user/repo/token व मजकूर
        var ae = document.activeElement; if (!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) window.loadWebsiteForm();
      }
      if (keys.indexOf('GP_MASTERS') >= 0 && window.loadMasters) window.loadMasters();     // नवीन फोनवर ग्रामपंचायतीचे नाव, दर, लोगो लगेच दिसावेत
      if (window.loadAllStats) window.loadAllStats();
      refreshVisibleLists();                                             // उघडी असलेली यादी (नोंदवही) नवीन नोंदींसह आपोआप ताजी
      if (keys.indexOf('GP_printlog') >= 0 && window.renderDashMonthCerts) window.renderDashMonthCerts();   // "या वर्षात दिलेले दाखले" संख्या
    } catch (e) {}
  }

  /* ---------- cycle ---------- */
  function cycle() {
    if (!isOn()) return Promise.resolve();
    if (busy) return Promise.resolve();
    if (navigator.onLine === false) { setStatus('off', 'ऑफलाईन — नेट आल्यावर आपोआप होईल'); return Promise.resolve(); }
    busy = true; setStatus('wait', 'Sync चालू…');
    if ((meta.v || 1) < 3) { scanLocal(true); saveMeta(true); }   // आधी Sync न होणारी की (उदा. प्रिंट-नोंद) असेल तर तिच्या जुन्या नोंदी एकदा पाठवतो
    return pull().then(function () { return push(); }).then(function () {
      lastOk = Date.now(); busy = false; setStatus('ok', '');
    }).catch(function (e) {
      busy = false;
      if (e.code === 'TOKEN_EXPIRED') setStatus('err', 'पुन्हा Sign in करा'); else setStatus('err', errMsg(e));
      throw e;
    });
  }
  function safeCycle() { return cycle().catch(function () {}); }
  var timer = null;
  function start() {
    if (timer) return;
    timer = setInterval(function () { if (!document.hidden) safeCycle(); }, POLL_MS);
    window.addEventListener('online', safeCycle);
    window.addEventListener('focus', safeCycle);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) safeCycle(); });
    setTimeout(safeCycle, 1200);
  }
  function signOut() {
    ensureLoaded();
    cfg.on = false; cfg.rt = ''; cfg.idt = ''; saveCfg();
    meta = { t: {}, out: {}, cur: '', conf: [], rv: {} }; saveMeta(true);
    setStatus('off', ''); paint(); closePanel();
  }

  /* ---------- UI ---------- */
  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function paint() {
    if (!ui.btn) return;
    var col = { off: '#9e9e9e', wait: '#f9a825', ok: '#2e7d32', err: '#c62828' }[status.s] || '#9e9e9e';
    if (!isOn()) col = '#9e9e9e';
    ui.dot.style.background = col;
    ui.btn.title = isOn() ? ('Cloud Sync — ' + (status.s === 'ok' ? 'अद्ययावत' : (status.m || status.s))) : 'Cloud Sync चालू करा';
    if (ui.panel && ui.panel.style.display !== 'none') renderPanel();
  }
  function emitStatus() { try { window.dispatchEvent(new Event('gpsync-status')); } catch (e) {} }
  function fmtAgo() { if (!lastOk) return '—'; var s = Math.round((Date.now() - lastOk) / 1000); return s < 60 ? 'आत्ताच' : Math.round(s / 60) + ' मिनिटांपूर्वी'; }
  function openPanel() { if (!ui.panel) return; ui.panel.style.display = 'flex'; renderPanel(); }
  function closePanel() { if (ui.panel) ui.panel.style.display = 'none'; }
  function renderPanel() {
    var box = ui.box, h = '<div style="display:flex;align-items:center;margin-bottom:10px"><b style="font-size:16px;color:#0D2B5E">☁️ Cloud Sync (फोन ↔ कॉम्प्युटर)</b><span id="gps-x" style="margin-left:auto;cursor:pointer;font-size:20px;padding:0 6px">✖</span></div>';
    if (isOn()) {
      var pend = Object.keys(meta.out).length, conf = (meta.conf || []).length;
      var st = status.s === 'ok' ? '<span style="color:#2e7d32">✅ अद्ययावत</span>' : status.s === 'wait' ? '<span style="color:#f9a825">⏳ चालू…</span>' : '<span style="color:#c62828">⚠️ ' + (status.m || 'त्रुटी') + '</span>';
      h += '<div style="line-height:1.9;font-size:14px">स्थिती: ' + st + '<br>खाते: <b>' + (cfg.email || '') + '</b><br>शेवटचा Sync: ' + fmtAgo() +
           '<br>पाठवायचे बाकी: <b>' + pend + '</b>' + (conf ? '<br>⚠️ conflict नोंदी: <b>' + conf + '</b> (हरलेल्या प्रती जपल्या आहेत)' : '') + '</div>' +
           '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button id="gps-now" class="btn btn-gn">🔄 आता Sync करा</button>' +
           '<button id="gps-out" class="btn btn-out">🚪 Sync बंद करा</button></div>' +
           '<div style="font-size:11.5px;color:#666;margin-top:10px">नेट असताना दर १० सेकंदांनी आपोआप Sync होतो. नेट नसताना केलेल्या नोंदी नेट आल्यावर पाठवल्या जातात.</div>';
    } else {
      h += '<div style="font-size:13.5px;line-height:1.8;color:#333">Cloud Sync अजून जोडलेला नाही.<br>सेटिंग <b>फक्त एकाच ठिकाणी</b> आहे: <b>⚙️ Masters → Google Firebase</b>. तिथे पायरी-पायरीने मार्गदर्शन, Project ID/API key, Email/Password आणि "Setup Code" आहे.</div>' +
           '<button id="gps-masters" class="btn btn-gn" style="width:100%;justify-content:center;margin-top:14px">⚙️ Masters मध्ये Sync सेटअप करा</button>';
    }
    box.innerHTML = h;
    var x = box.querySelector('#gps-x'); if (x) x.onclick = closePanel;
    var now = box.querySelector('#gps-now'); if (now) now.onclick = function () { cycle().catch(function () {}); };
    var out = box.querySelector('#gps-out'); if (out) out.onclick = function () { if (confirm('Sync बंद करायचा का? (या डिव्हाइसवरील डेटा तसाच राहील)')) signOut(); };
    var gm = box.querySelector('#gps-masters');
    if (gm) gm.onclick = function () { closePanel(); try { window.showPg('masters'); window.scrollTo(0, 0); } catch (e) {} };
  }
  function buildUi() {
    if (ui.btn || !document.body) return;
    ui.btn = el('div', 'position:fixed;right:12px;bottom:70px;z-index:99998;width:46px;height:46px;border-radius:50%;background:#0D2B5E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:21px;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer;user-select:none', '☁️');
    ui.dot = el('span', 'position:absolute;right:2px;top:2px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;background:#9e9e9e');
    ui.btn.appendChild(ui.dot); ui.btn.onclick = openPanel;
    ui.panel = el('div', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:14px');
    ui.box = el('div', 'background:#fff;border-radius:14px;padding:16px;width:100%;max-width:430px;max-height:92vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.4)');
    ui.panel.appendChild(ui.box); ui.panel.onclick = function (e) { if (e.target === ui.panel) closePanel(); };
    document.body.appendChild(ui.btn); document.body.appendChild(ui.panel);
    paint();
  }
  function init() {
    if (!window.__gpRaw) return;      // शिम अजून तयार नाही — नंतर 'load' वर पुन्हा येईल
    ensureLoaded();
    buildUi();
    if (isOn()) { setStatus('wait', ''); start(); }
  }

  window.GPSync = { onSet: onSet, onRemove: onRemove, onClear: onClear, signIn: signIn, signOut: signOut,
                    syncNow: function () { return cycle(); }, openPanel: openPanel, init: init,
                    isOn: isOn, errText: errMsg, status: function () { return { s: status.s, m: status.m, last: lastOk, pending: Object.keys(meta.out).length, conflicts: meta.conf.length, cfg: cfg }; },
                    _meta: function () { return meta; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
  window.addEventListener('load', init);
})();
