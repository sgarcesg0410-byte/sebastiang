import org.gradle.api.GradleException

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")?.trim().orEmpty()
val releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")?.trim().orEmpty()
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")?.trim().orEmpty()
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")?.trim().orEmpty()
val hasReleaseSigningConfig =
    releaseKeystorePath.isNotEmpty() &&
    releaseKeystorePassword.isNotEmpty() &&
    releaseKeyAlias.isNotEmpty() &&
    releaseKeyPassword.isNotEmpty() &&
    file(releaseKeystorePath).exists()

android {
    namespace = "app.sebastiang.studio"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.sebastiang.studio"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "2.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (hasReleaseSigningConfig) {
            create("release") {
                storeFile = file(releaseKeystorePath)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            if (hasReleaseSigningConfig) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isDebuggable = true
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// Fail-closed: jamás producir un APK/AAB release sin firma de producción ni usar clave de depuración
gradle.taskGraph.whenReady {
    val isReleaseArtifactRequested = allTasks.any { task ->
        val n = task.name.lowercase()
        (n.contains("assemblerelease") || n.contains("bundlerelease") || n.contains("packagerelease"))
    }
    if (isReleaseArtifactRequested && !hasReleaseSigningConfig) {
        throw GradleException(
            "Build release bloqueada (fail-closed): configura ANDROID_KEYSTORE_PATH (archivo existente), " +
            "ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS y ANDROID_KEY_PASSWORD antes de generar un APK/AAB de producción."
        )
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.8.0")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.10.0")
    // Criptografía con hardware Keystore y BiometricPrompt nativo
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.biometric:biometric:1.1.0")
    // OneSignal Push SDK
    implementation("com.onesignal:OneSignal:5.1.19")
}
