# 📱 ग्रामपंचायत — Android APK (GitHub वर बनवा)

हा प्रोजेक्ट `www/` मधली वेब-ॲप (गप-v2 ची मोबाईल आवृत्ती) Android ॲपमध्ये गुंडाळतो. APK GitHub Actions वर आपोआप बनते — तुमच्या संगणकावर Android Studio लागत नाही.

## APK बनवायची पद्धत
1. GitHub वर **नवी private repository** बनवा (उदा. `gp-mobile-apk`).
2. या फोल्डरमधील **सर्व फाईली** (लपवलेला `.github` फोल्डर आणि `signing` सह) त्यात अपलोड करा.
   - ⚠️ `.github` फोल्डर अपलोड होतो आहे याची खात्री करा (GitHub वेबवर drag-drop करताना लपलेले फोल्डर कधी सुटतात; Git/GitHub Desktop वापरणे सोपे).
3. **Actions** टॅब → **Build APK** → **Run workflow**. (साधारण ८–१२ मिनिटे.)
4. पूर्ण झाल्यावर त्या run मध्ये खाली **Artifacts → GramPanchayat-APK** डाउनलोड करा → आतली `GramPanchayat.apk` फोनवर पाठवा.
5. फोनवर APK उघडा → "Install unknown apps" ची परवानगी द्या → Install.
6. ॲप उघडा → **☁️** → Cloud Sync (Firebase) जोडा. (MOBILE-SETUP.md पहा)

## APK मधला डेटा
- ॲपमधला डेटा फोनच्या ॲप-साठ्यात असतो; **ॲप uninstall केल्यास तो जातो**. म्हणून ☁️ Cloud Sync चालू ठेवा (किंवा मुख्य पान → Backup).
- APK पुन्हा बनवून त्यावर install केल्यास (अपडेट) डेटा तसाच राहतो, कारण `signing/gp-release.p12` ही कायमची सही-की वापरली जाते आणि `versionCode` प्रत्येक run ला वाढतो.
  ⚠️ ही की repository मध्ये आहे — repository **private** ठेवा. Play Store वर टाकायचे असल्यास स्वतःची नवी की वापरा.

## वेब-ॲप बदलल्यावर APK कशी अपडेट करावी
`gp-v2` मध्ये बदल केल्यानंतर:
```
node build-tools/make-web.js --apk --out ../gp-mobile-apk/www
```
(`../gp-mobile-apk` = ही repository ज्या फोल्डरमध्ये आहे तो) → बदल GitHub वर push करा → Actions आपोआप नवी APK बनवते.

## APK मध्ये काय वेगळे चालते (प्रामाणिकपणे)
- **प्रिंट:** Android चा प्रिंट डायलॉग उघडतो → "Save as PDF" किंवा Wi-Fi प्रिंटर. पान-आकार (A4/Legal, आडवे/उभे) दिला जातो, पण नोंदवहीचे पान-क्रमांक/पान-भरणा संगणकासारखे आपोआप नाही.
- **Excel / CSV / Backup (JSON):** Share डायलॉग उघडतो → Drive, WhatsApp, Files इ. मध्ये सेव्ह करा.
- **WhatsApp / लिंक:** फोनचा ब्राउझर/WhatsApp उघडतो.
- **पावती JPG:** तयार होऊन Share डायलॉग उघडतो (तिथून WhatsApp निवडा). "क्लिपबोर्डवर कॉपी झाली" असा संदेश दिसू शकतो — तो या आवृत्तीत चुकीचा आहे; Share डायलॉग हेच खरे.
- **फक्त कॉम्प्युटरवर:** वेबसाईट प्रकाशन, license activation.
- ⚠️ ही APK मी प्रत्यक्ष फोनवर / Gradle ने बनवून तपासलेली नाही; पहिल्या बिल्डमध्ये अडचण आल्यास Actions चा error लॉग पाठवा.
