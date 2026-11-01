/* ============================================================================
   samarth.js — नमुना ८ मधील करदात्यांची माहिती "Samarth Portal" च्या TaxPayerTemplate.xlsx मध्ये भरून देतो.
   • मूळ टेम्प्लेट (dropdown, लपवलेली Lists शीट, स्तंभांची रुंदी) जसेच्या तसे ठेवून फक्त डेटा ओळी भरतो.
   • मराठी नावावरून English नाव आपोआप (Devanagari → Latin transliteration, सामान्य आडनावे/नावांच्या शब्दकोशासह) बनवतो.
   • जे आधारित/खात्रीने भरता येते तेवढेच भरतो; बाकी (Category, Pin Code, Email, Panchayat Entity Code इ.) रिकामे — वापरकर्ता Excel मध्ये भरतो.
   ========================================================================== */
(function () {
  'use strict';
  var TPL_B64 = "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";

  /* ---------- Devanagari → English ---------- */
  var CONS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l' };
  var IV = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ru', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' };
  var MATRA = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ru', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o' };
  var HEAVY = { 'ा': 1, 'ी': 1, 'ू': 1, 'े': 1, 'ै': 1, 'ो': 1, 'ौ': 1, 'ॉ': 1 };
  var DEVDIG = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

  // सामान्य आडनावे / नावे / शब्द — नेहमीची English स्पेलिंग (शब्दकोशात नसलेले शब्द नियमांनी बनतात)
  var DICT = {
    'पाटील': 'Patil', 'गायकवाड': 'Gaikwad', 'जाधव': 'Jadhav', 'शिंदे': 'Shinde', 'पवार': 'Pawar', 'भोसले': 'Bhosale', 'चव्हाण': 'Chavan', 'देशमुख': 'Deshmukh',
    'कुलकर्णी': 'Kulkarni', 'काळे': 'Kale', 'माने': 'Mane', 'मोरे': 'More', 'सावंत': 'Sawant', 'कदम': 'Kadam', 'साळुंखे': 'Salunkhe', 'थोरात': 'Thorat',
    'लोखंडे': 'Lokhande', 'निंबाळकर': 'Nimbalkar', 'मोहिते': 'Mohite', 'घाडगे': 'Ghadge', 'बनसोडे': 'Bansode', 'वाघमारे': 'Waghmare', 'भालेराव': 'Bhalerao',
    'जगताप': 'Jagtap', 'शेख': 'Shaikh', 'सय्यद': 'Sayyed', 'तांबोळी': 'Tamboli', 'कांबळे': 'Kamble', 'गोरे': 'Gore', 'ढवळे': 'Dhawale', 'मगर': 'Magar',
    'यादव': 'Yadav', 'कोळी': 'Koli', 'सुर्वे': 'Surve', 'गवळी': 'Gawali', 'शिंगाडे': 'Shingade', 'लांडगे': 'Landge', 'मोटे': 'Mote', 'भगत': 'Bhagat',
    'खराडे': 'Kharade', 'कोकरे': 'Kokare', 'कोरे': 'Kore', 'सोनवणे': 'Sonawane', 'गुरव': 'Gurav', 'नलवडे': 'Nalawade', 'फडतरे': 'Phadtare', 'वाघ': 'Wagh',
    'शिरसाट': 'Shirsat', 'ताटे': 'Tate', 'बोराडे': 'Borade', 'उबाळे': 'Ubale', 'माळी': 'Mali', 'सुतार': 'Sutar', 'लोहार': 'Lohar', 'कुंभार': 'Kumbhar',
    'तेली': 'Teli', 'बनकर': 'Bankar', 'खरात': 'Kharat', 'गाडे': 'Gade', 'लाड': 'Lad', 'चौगुले': 'Chougule', 'दळवी': 'Dalvi', 'राऊत': 'Raut', 'तावरे': 'Taware',
    'जाधवर': 'Jadhavar', 'ढेरे': 'Dhere', 'पाटोळे': 'Patole', 'पोळ': 'Pol', 'भिसे': 'Bhise', 'कारंडे': 'Karande', 'करडे': 'Karade', 'शेळके': 'Shelke', 'झेंडे': 'Zende',
    'खंडागळे': 'Khandagale', 'सपकाळ': 'Sapkal', 'बागल': 'Bagal', 'गुंड': 'Gund', 'माळवे': 'Malwe', 'ओव्हाळ': 'Ovhal', 'आवताडे': 'Awatade', 'धायगुडे': 'Dhaigude',
    'ज्ञानेश्वर': 'Dnyaneshwar', 'ज्ञानदेव': 'Dnyandev', 'सचिन': 'Sachin', 'सुनील': 'Sunil', 'अनिल': 'Anil', 'संजय': 'Sanjay', 'राजेंद्र': 'Rajendra',
    'दत्तात्रय': 'Dattatray', 'गणेश': 'Ganesh', 'महादेव': 'Mahadev', 'बाळासाहेब': 'Balasaheb', 'विठ्ठल': 'Vitthal', 'लक्ष्मण': 'Laxman', 'रामचंद्र': 'Ramchandra',
    'सुभाष': 'Subhash', 'शिवाजी': 'Shivaji', 'तानाजी': 'Tanaji', 'दिलीप': 'Dilip', 'प्रकाश': 'Prakash', 'अशोक': 'Ashok', 'भीमराव': 'Bhimrao', 'तुकाराम': 'Tukaram',
    'विजय': 'Vijay', 'रमेश': 'Ramesh', 'सुरेश': 'Suresh', 'महेश': 'Mahesh', 'राजू': 'Raju', 'बापू': 'Bapu', 'दादा': 'Dada', 'नाना': 'Nana', 'आबा': 'Aba', 'बाबा': 'Baba',
    'शंकर': 'Shankar', 'हनुमंत': 'Hanumant', 'बळीराम': 'Baliram', 'नामदेव': 'Namdev', 'एकनाथ': 'Eknath', 'सोपान': 'Sopan', 'पांडुरंग': 'Pandurang', 'बजरंग': 'Bajrang',
    'किसन': 'Kisan', 'कृष्णा': 'Krushna', 'कृष्ण': 'Krushna', 'अभिजीत': 'Abhijit', 'अमोल': 'Amol', 'अजय': 'Ajay', 'अविनाश': 'Avinash', 'योगेश': 'Yogesh', 'नितीन': 'Nitin',
    'प्रवीण': 'Pravin', 'प्रशांत': 'Prashant', 'रवींद्र': 'Ravindra', 'रविंद्र': 'Ravindra', 'सतीश': 'Satish', 'दीपक': 'Deepak', 'हरी': 'Hari', 'हरिभाऊ': 'Haribhau',
    'रावसाहेब': 'Raosaheb', 'भाऊसाहेब': 'Bhausaheb', 'आण्णा': 'Anna', 'अण्णा': 'Anna', 'सदाशिव': 'Sadashiv', 'मारुती': 'Maruti', 'यशवंत': 'Yashwant', 'शहाजी': 'Shahaji',
    'ज्योती': 'Jyoti', 'सुनीता': 'Sunita', 'सविता': 'Savita', 'मंगल': 'Mangal', 'लक्ष्मी': 'Laxmi', 'सरस्वती': 'Saraswati', 'शोभा': 'Shobha', 'वैशाली': 'Vaishali',
    'मनीषा': 'Manisha', 'अनिता': 'Anita', 'मीना': 'Meena', 'कविता': 'Kavita', 'रेखा': 'Rekha', 'आशा': 'Asha', 'उषा': 'Usha', 'सुमन': 'Suman', 'कमल': 'Kamal',
    'पार्वती': 'Parvati', 'सीता': 'Sita', 'राधा': 'Radha', 'शांताबाई': 'Shantabai', 'सखुबाई': 'Sakhubai', 'सुवर्णा': 'Suvarna', 'सुनंदा': 'Sunanda', 'संगीता': 'Sangita',
    'सरिता': 'Sarita', 'अर्चना': 'Archana', 'प्रियंका': 'Priyanka', 'पूजा': 'Pooja', 'स्वाती': 'Swati', 'सुशीला': 'Sushila', 'शकुंतला': 'Shakuntala', 'विमल': 'Vimal',
    'कांता': 'Kanta', 'छाया': 'Chhaya', 'मालन': 'Malan', 'गीता': 'Geeta', 'सुरेखा': 'Surekha', 'रंजना': 'Ranjana', 'वंदना': 'Vandana', 'जयश्री': 'Jayshree',
    'व': 'and', 'इतर': 'Others', 'आणि': 'and',
    'गावठाण': 'Gavthan', 'गल्ली': 'Galli', 'रोड': 'Road', 'रस्ता': 'Road', 'नगर': 'Nagar', 'वस्ती': 'Vasti', 'चौक': 'Chowk', 'मंदिर': 'Mandir', 'शाळा': 'Shala',
    'बाजार': 'Bazar', 'पेठ': 'Peth', 'कॉलनी': 'Colony', 'वाडी': 'Wadi', 'मळा': 'Mala', 'वरवडे': 'Warawade', 'माढा': 'Madha', 'सोलापूर': 'Solapur', 'उपळाई': 'Uplai'
  };
  // पहिल्या नावावरून लिंग ओळखण्यासाठी (खात्रीच्या सामान्य नावांपुरतेच)
  var FEM = {}, MALE = {};
  'ज्योती सुनीता सविता मंगल लक्ष्मी सरस्वती शोभा वैशाली मनीषा अनिता मीना कविता रेखा आशा उषा सुमन कमल पार्वती सीता राधा शांताबाई सखुबाई सुवर्णा सुनंदा संगीता सरिता अर्चना प्रियंका पूजा स्वाती सुशीला शकुंतला विमल कांता छाया मालन गीता सुरेखा रंजना वंदना जयश्री'.split(' ').forEach(function (n) { FEM[n] = 1; });
  'ज्ञानेश्वर ज्ञानदेव सचिन सुनील अनिल संजय राजेंद्र दत्तात्रय गणेश महादेव बाळासाहेब विठ्ठल लक्ष्मण रामचंद्र सुभाष शिवाजी तानाजी दिलीप प्रकाश अशोक भीमराव तुकाराम विजय रमेश सुरेश महेश राजू बापू शंकर हनुमंत बळीराम नामदेव एकनाथ सोपान पांडुरंग बजरंग किसन कृष्णा कृष्ण अभिजीत अमोल अजय अविनाश योगेश नितीन प्रवीण प्रशांत रवींद्र रविंद्र सतीश दीपक हरी हरिभाऊ रावसाहेब भाऊसाहेब सदाशिव मारुती यशवंत शहाजी'.split(' ').forEach(function (n) { MALE[n] = 1; });

  function syllables(w) {
    var out = [], i = 0, n = w.length;
    while (i < n) {
      var ch = w[i];
      if (CONS[ch]) {
        var c = CONS[ch], conj = false;
        if (ch === 'ज' && w[i + 1] === '्' && w[i + 2] === 'ञ') { c = 'dny'; i += 2; conj = true; }   // ज्ञ → dny (मराठी)
        i++;
        if (w[i] === '़') i++;
        while (w[i] === '्' && CONS[w[i + 1]]) { c += (CONS[w[i + 1]] === 'v' ? 'w' : CONS[w[i + 1]]); conj = true; i += 2; if (w[i] === '़') i++; }   // श्व → shw
        if (w[i] === '्') { i++; out.push({ c: c, v: '', heavy: false, conj: conj }); continue; }
        var m = MATRA[w[i]];
        if (m !== undefined) { out.push({ c: c, v: m, heavy: !!HEAVY[w[i]], conj: conj }); i++; }
        else out.push({ c: c, v: '*', heavy: false, conj: conj });
      } else if (IV[ch]) { out.push({ c: '', v: IV[ch], heavy: /[आईऊएऐओऔ]/.test(ch) }); i++; }
      else if (ch === 'ं' || ch === 'ँ') { out.push({ nas: true }); i++; }
      else if (ch === 'ः') { out.push({ lit: 'h' }); i++; }
      else if (DEVDIG[ch]) { out.push({ lit: DEVDIG[ch] }); i++; }
      else { out.push({ lit: ch }); i++; }
    }
    return out;
  }
  function trCore(w) {
    var S = syllables(w), real = [], k;
    for (k = 0; k < S.length; k++) if (S[k].c !== undefined) real.push(k);
    var res = '';
    for (k = 0; k < S.length; k++) {
      var s = S[k];
      if (s.lit !== undefined) { res += s.lit; continue; }
      if (s.nas) { var nx = null, j; for (j = k + 1; j < S.length; j++) if (S[j].c) { nx = S[j].c; break; } res += (nx && /^(p|ph|b|bh|m)/.test(nx)) ? 'm' : 'n'; continue; }
      var v = s.v;
      if (v === '*') {
        var rk = real.indexOf(k), next = S[k + 1], isLast = rk === real.length - 1, hasNasNext = next && next.nas;
        var prev = null, j2; for (j2 = k - 1; j2 >= 0; j2--) if (S[j2].c !== undefined) { prev = S[j2]; break; }
        var nr = isLast ? null : S[real[rk + 1]], nrLast = rk + 1 === real.length - 1, nrNas = nr && S[real[rk + 1] + 1] && S[real[rk + 1] + 1].nas;
        if (hasNasNext) v = 'a';
        else if (isLast) v = s.conj ? 'a' : '';                    // शेवटचा 'अ' गळतो (राम → Ram), पण जोडाक्षरानंतर राहतो (चंद्र → chandra)
        else if (prev && prev.heavy && nr && !nrLast && (nrNas || nr.conj)) v = '';   // जड अक्षरानंतरचा मधला 'अ' गळतो (रामचंद्र → Ramchandra)
        else v = 'a';
      }
      res += s.c + v;
    }
    return res;
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function trWord(w) {
    var core = w.replace(/[.,;:()\[\]"'“”‘’]/g, '');
    if (!core) return w;
    if (DICT[core]) return DICT[core];
    var r = trCore(core);
    if (/राव$/.test(core) && /rav$/.test(r)) r = r.replace(/rav$/, 'rao');     // भीमराव → Bhimrao
    return cap(r);
  }
  function trPhrase(s) {
    return String(s || '').replace(/[\u200b\u200c\u200d]/g, '').trim().split(/\s+/).filter(Boolean).map(function (w) {
      return /[\u0900-\u097F]/.test(w) ? trWord(w) : w;
    }).join(' ');
  }

  /* ---------- मालकाचे नाव: सन्मानदर्शक काढणे + लिंग/नाते ओळखणे ---------- */
  var HON = /^(श्रीमती|श्री|सौ|कु|कुमारी)(\.\s*|\s+)/;
  function parseOwner(raw) {
    var s = String(raw || '').replace(/\s+/g, ' ').trim(), gender = '', rel = '';
    var m = HON.exec(s);
    if (m) {
      s = s.slice(m[0].length).trim();
      if (m[1] === 'श्री') gender = 'Male';
      else { gender = 'Female'; rel = (m[1] === 'कु' || m[1] === 'कुमारी') ? 'D/o' : 'W/o'; }
    }
    var parts = s.split(' ').filter(Boolean);
    if (!gender && parts.length) {
      var f = parts[0];
      if (FEM[f] || /(बाई|ताई|देवी|कौर)$/.test(f)) gender = 'Female';
      else if (MALE[f] || /(सिंह|कुमार)$/.test(f)) gender = 'Male';
    }
    var en = trPhrase(s);
    return { local: s, english: en, gender: gender, rel: rel, parts: parts, enParts: en.split(' ') };
  }

  /* ---------- पंक्ती बनवणे ---------- */
  function normMobile(v) {
    var d = String(v == null ? '' : v).replace(/[०-९]/g, function (c) { return DEVDIG[c]; }).replace(/\D/g, '');
    if (d.length === 12 && d.slice(0, 2) === '91') d = d.slice(2);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  }
  // एका मिळकतीच्या "मालकाचे नाव" मधून प्रत्येक व्यक्तीचे वेगळे नाव काढतो:
  //  • कंसातील नावे वगळतो — कंसाच्या आधीचे नावच घेतो: "राम पाटील (शाम पाटील)" → राम पाटील
  //  • एकापेक्षा जास्त नावे (नवीन ओळ , ; / & व आणि) असतील तर प्रत्येकाचे स्वतंत्र नाव; "व इतर" वगळतो
  function splitOwners(raw) {
    var s = String(raw || '').replace(/[\u200b\u200c\u200d]/g, '');
    s = s.replace(/[\(\[\{（][^\)\]\}）]*[\)\]\}）]/g, ' ');   // पूर्ण कंस काढा
    s = s.replace(/[\(\[\{（][\s\S]*$/, ' ');                      // न संपलेला कंस: त्यापुढचे सर्व वगळा
    var OTH = /^(इतर|ईतर|इतरांचे|वगैरे|इत्यादी|etc\.?|others?)$/i;
    return s.split(/[\n\r,;\/&|]+|\s+(?:व|आणि)\s+/).map(function (x) {
      x = x.replace(/\s+/g, ' ').replace(/^[\s.\-–]+|[\s.\-–]+$/g, '');
      var w = x.split(' '), i;                                  // "इतर" / "वगैरे" पासून पुढचे सर्व वगळा ("राम पाटील इतर ४" → राम पाटील)
      for (i = 0; i < w.length; i++) if (OTH.test(w[i])) { w = w.slice(0, i); break; }
      return w.join(' ').replace(/\s+व$/, '').trim();
    }).filter(Boolean);
  }
  var GPOWN = /ग्रा[ंम]?[\s.]*पंचायत|ग्रा[ंम]?[\s.]*पं?(?![\u0900-\u097F])|grampanchayat|gram\s*panchayat|\bgr?\.?\s?p\.(?=\s|$)/i;   // ग्रामपंचायत, ग्राम पंचायत, ग्रा.पं., ग्रा.प, ग्रा पं …
  function buildRows(data, masters) {
    var G = masters || {};
    var gpM = String(G['s-gp'] || '').trim(), talM = String(G['s-tal'] || '').trim(), distM = String(G['s-dist'] || '').trim();
    var lgd = String(G['s-lgd'] || '').split('/')[0].replace(/[०-९]/g, function (c) { return DEVDIG[c]; }).replace(/\D/g, '');
    var keys = Object.keys(data).sort(function (a, b) { return (Number(a) || 0) - (Number(b) || 0); });
    var seen = {}, rows = [], props = 0, skipped = 0;
    keys.forEach(function (k) {
      var r = data[k], raw = String((r && r.owner) || '').trim();
      if (!raw) return;
      // धार्मिक / शैक्षणिक कर सवलत व इतर कर सवलत असलेल्या मिळकती Samarth Excel मध्ये घ्यायच्या नाहीत
      if (r && (r.karPrakar === 'dharmik' || r.karPrakar === 'itar')) { skipped++; return; }
      props++;
      var mob = normMobile(r.wa), names;
      // मालक ग्रामपंचायत असेल तर करदाता = भोगवटादार (r.occ); भोगवटादार नसेल ("स्वतः"/रिकामा) तर ती मिळकत यादीत घ्यायची नाही
      if (GPOWN.test(raw)) {
        var occ = String(r.occ || '').trim();
        names = (!occ || /^स्वतः?$/.test(occ) || GPOWN.test(occ)) ? [] : splitOwners(occ);
      } else names = splitOwners(raw);
      // पत्ता (मराठीत): घर नं., रस्ता/गल्ली, ग्रामपंचायत, ता., जि.
      var addr = [];
      if (r.pno) addr.push('घर नं. ' + String(r.pno).trim());
      if (r.road) addr.push(String(r.road).trim());
      if (gpM) addr.push(gpM);
      if (talM) addr.push('ता. ' + talM);
      if (distM) addr.push('जि. ' + distM);
      var address = addr.join(', ');
      names.forEach(function (nm, idx) {
        var p = parseOwner(nm), key = p.local.toLowerCase();
        if (!p.local) return;
        if (seen[key] !== undefined) { var x = rows[seen[key]]; if (!x.G && mob && idx === 0) x.G = mob; return; }   // एकाच व्यक्तीचे नाव अनेक मिळकतींत = एकच ओळ
        // A=English नाव, B=मराठी नाव, C=Gender, D=Category(रिकामे), E=S/o W/o D/o, F=वडील/पतीचे नाव (मराठीत), G=मोबाईल,
        // H=Pin(रिकामे), I=Email(रिकामे), J=पत्ता (मराठीत), K=Panchayat Entity Code(रिकामे — वापरकर्ता भरतो), L=Village LGD Code (ग्रामपंचायत LGD कोड), M=Exemption
        var row = { A: p.english, B: p.local, C: p.gender, D: '', E: '', F: '', G: idx === 0 ? mob : '', H: '', I: '', J: address, K: '', L: lgd, M: 'Not Exempted' };
        // "नाव वडील/पती आडनाव" अशी तीन भागांची नावे असतील तरच (आणि लिंग/नाते ओळखले असेल तरच) S/o, W/o, D/o व वडील/पतीचे नाव भरतो
        if (p.parts.length >= 3 && p.gender === 'Male') { row.E = 'S/o'; row.F = p.parts.slice(1).join(' '); }
        else if (p.parts.length >= 3 && p.gender === 'Female' && p.rel) { row.E = p.rel; row.F = p.parts.slice(1).join(' '); }
        seen[key] = rows.length; rows.push(row);
      });
    });
    return { rows: rows, props: props, skipped: skipped };
  }

  /* ---------- टेम्प्लेटमध्ये ओळी भरणे (मूळ फाईलची बाकी रचना तशीच) ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var COLS = 'ABCDEFGHIJKLM'.split('');
  function sheetXml(xml, rows) {
    var last = rows.length + 1, body = '';
    rows.forEach(function (r, idx) {
      var rn = idx + 2, cells = '';
      COLS.forEach(function (c) {
        var v = r[c];
        if (v !== undefined && v !== null && String(v) !== '') cells += '<c r="' + c + rn + '" s="0" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      });
      body += '<row r="' + rn + '">' + cells + '</row>';
    });
    var a = xml.indexOf('<row r="2"'), b = xml.indexOf('</sheetData>');
    if (a < 0 || b < 0) throw new Error('टेम्प्लेटची रचना ओळखता आली नाही');
    xml = xml.slice(0, a) + body + xml.slice(b);
    xml = xml.replace(/<dimension ref="[^"]*"\s*\/>/, '<dimension ref="A1:M' + last + '" />');
    var end = Math.max(100, last + 100);                       // dropdown पुरेशा ओळींपर्यंत (टेम्प्लेटमध्ये फक्त १०० पर्यंत होते)
    var dv = '<dataValidations count="4">' +
      '<dataValidation type="list" sqref="C2:C' + end + '"><formula1>"Male,Female"</formula1></dataValidation>' +
      '<dataValidation type="list" sqref="D2:D' + end + '"><formula1>"General,OBC,SC,ST,Other"</formula1></dataValidation>' +
      '<dataValidation type="list" sqref="E2:E' + end + '"><formula1>"S/o,W/o,D/o"</formula1></dataValidation>' +
      '<dataValidation type="list" sqref="M2:M' + end + '"><formula1>=IF($C2="Male",MaleList,FemaleList)</formula1></dataValidation></dataValidations>';
    xml = xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, dv);
    return xml;
  }
  function makeXlsx(rows) {
    var Z = window.JSZip;
    if (!Z) { try { Z = window.JSZip = require('./lib/jszip.min.js'); } catch (e) {} }
    if (!Z) return Promise.reject(new Error('JSZip लोड झाले नाही'));
    return Z.loadAsync(TPL_B64, { base64: true }).then(function (zip) {
      return zip.file('xl/worksheets/sheet1.xml').async('string').then(function (xml) {
        var hasBom = xml.charCodeAt(0) === 0xFEFF;
        zip.file('xl/worksheets/sheet1.xml', (hasBom ? '\uFEFF' : '') + sheetXml(hasBom ? xml.slice(1) : xml, rows));
        return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
      });
    });
  }

  function exportSamarthExcel() {
    var toast = function (m, t) { try { window.showToast(m, t || 4500); } catch (e) {} };
    var data = {}; try { data = window.loadData('n8') || {}; } catch (e) {}
    var built = buildRows(data, window.GP || {});
    if (!built.rows.length) { toast('⚠️ नमुना ८ मध्ये नोंदी नाहीत'); return; }
    toast('⏳ Samarth Excel तयार होत आहे…', 2000);
    makeXlsx(built.rows).then(function (blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a'), g = String((window.GP || {})['s-gp-e'] || 'GP').replace(/[^A-Za-z0-9]+/g, '_');
      a.href = url; a.download = 'TaxPayerTemplate.xlsx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast('✅ Excel तयार: ' + built.rows.length + ' करदाते (' + built.props + ' मिळकतींतून)' + (built.skipped ? ' · ' + built.skipped + ' सवलत (धार्मिक/शैक्षणिक/इतर) मिळकती वगळल्या' : '') + '. English नावे आपोआप बनवली आहेत — Excel मध्ये तपासून घ्या; Category, Pin Code, Email, Panchayat Entity Code इ. रिकामे आहेत.', 9000);
    }).catch(function (e) { toast('❌ Excel तयार झाली नाही: ' + (e && e.message || e), 6000); });
  }

  window.GPSamarth = { translit: trPhrase, parseOwner: parseOwner, splitOwners: splitOwners, buildRows: buildRows, makeXlsx: makeXlsx, sheetXml: sheetXml };
  window.exportSamarthExcel = exportSamarthExcel;
  if (typeof module !== 'undefined' && module.exports) module.exports = window.GPSamarth;
})();
