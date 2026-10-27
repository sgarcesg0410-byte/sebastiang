# Reglas de ofuscación y optimización R8/ProGuard para Sebastian G Studio

# Conservar métodos accesibles desde JavaScript vía JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class app.sebastiang.studio.bridge.AndroidNotificationBridge { *; }
-keep class app.sebastiang.studio.security.SecureTokenStorage { *; }

# OneSignal SDK rules
-keep class com.onesignal.** { *; }
-dontwarn com.onesignal.**

# Reglas de seguridad para EncryptedSharedPreferences
-keep class androidx.security.crypto.** { *; }
