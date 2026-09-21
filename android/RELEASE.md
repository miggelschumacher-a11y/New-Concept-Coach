# Android-Release (Google Play)

Die App-ID ist `com.conceptcoachai.trainingsapp`. Versionsnummer und Signierung
sind vorbereitet; die eigentliche Freigabe läuft über die Play Console.

## Einmalig: Upload-Schlüssel anlegen

Den Schlüssel erzeugst du selbst und wählst die Passwörter selbst. Er gehört
**nicht** ins Projekt und wird **nicht** eingecheckt.

```bash
keytool -genkeypair -v -keystore C:/Users/DEIN-NAME/keystores/concept-coach-upload.jks -storetype PKCS12 -alias concept-coach-upload -keyalg RSA -keysize 2048 -validity 10000
```

1. Die Datei `.jks` und beide Passwörter **mehrfach sichern** (Passwortmanager,
   externer Datenträger). Geht der Schlüssel verloren, muss der Upload-Schlüssel
   über den Google-Support zurückgesetzt werden.
2. `android/keystore.properties.example` nach `android/keystore.properties`
   kopieren und Pfad, Passwörter und Alias eintragen. Diese Datei ist per
   `.gitignore` ausgeschlossen.
3. In der Play Console beim ersten Upload **Play App Signing** aktivieren: Google
   verwaltet den eigentlichen Signaturschlüssel, du lädst nur mit dem
   Upload-Schlüssel hoch.

Ohne `keystore.properties` funktionieren Debug-Builds wie bisher; ein
Release-Build wird mit einer Fehlermeldung abgelehnt.

## Bei jedem Release

1. Version erhöhen (erhöht auch die `versionCode`, die Google Play vergleicht und
   die bei jedem Upload größer werden muss):

   ```bash
   npm run android:version -- patch      # 1.0.0 -> 1.0.1
   npm run android:version -- minor      # 1.0.1 -> 1.1.0
   npm run android:version -- 2.0.0      # Namen direkt setzen
   npm run android:version               # nur die aktuelle Version anzeigen
   ```

   Gespeichert wird sie in `android/version.properties` (mit einchecken).
2. Signiertes Bundle bauen:

   ```bash
   npm run android:release
   ```

   Ergebnis: `android/app/build/outputs/bundle/release/app-release.aab`
3. Die `.aab` in der Play Console hochladen (zuerst auf „Interne Tests“, dann
   weiter zu Produktion, gern gestaffelt). Die Geräte holen das Update danach
   über den Play Store selbst, sofern automatische App-Updates aktiv sind.

## Wichtig für Geräte mit der Debug-Version

Eine mit dem Debug-Schlüssel installierte App (`adb install`) hat eine andere
Signatur als die Play-Version. Android akzeptiert das Update nicht darüber: Man
muss erst deinstallieren, und dabei gehen die Daten der App verloren. Vorher die
Daten sichern (Konfiguration → Daten).
