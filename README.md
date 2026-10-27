# 📸 Sebastian G • Estudio Fotográfico & Plataforma de Reservas

> **Plataforma web, móvil y de escritorio de grado profesional para reservas de sesiones fotográficas, selección privada de galerías con marca de agua, facturación electrónica con recibos PDF de lujo, cobros móviles (Nequi, DaviPlata, Dale!) e inteligencia contable para fotos impresas y cuadros en retablo de madera.**

---

## 📑 Tabla de Contenidos

1. [Visión General](#-visión-general)
2. [Stack Tecnológico](#-stack-tecnológico)
3. [Estructura del Proyecto](#-estructura-del-proyecto)
4. [Catálogo Oficial de Tarifas y Servicios](#-catálogo-oficial-de-tarifas-y-servicios)
   - [Paquetes de Sesiones](#1-paquetes-de-sesiones)
   - [Fotos Impresas en Papel](#2-fotos-impresas-en-papel-laboratorio)
   - [Cuadros en Retablos de Madera (Costos y Ganancias)](#3-cuadros-en-retablos-de-madera-costos-y-ganancias)
5. [Módulos del Sistema](#-módulos-del-sistema)
   - [Landing Page & Catálogo](#1-landing-page--catálogo-público)
   - [Motor de Reservas & Disponibilidad](#2-motor-de-reservas--agenda-inteligente)
   - [Galería Privada del Cliente](#3-galería-privada-del-cliente--selección-protegida)
   - [Pasarelas Móviles & Comprobantes](#4-pasarelas-móviles--comprobantes-de-pago)
   - [Generador de Recibos PDF de Lujo](#5-generador-de-recibos-pdf-de-lujo-con-qr)
   - [Dashboard Administrativo (POS)](#6-dashboard-administrativo-pos--inteligencia-de-negocio)
   - [Sistema de Notificaciones Push 24/7](#7-sistema-de-notificaciones-push-247)
6. [Base de Datos y Persistencia Oficial en MongoDB Atlas](#-base-de-datos-y-persistencia-oficial-en-mongodb-atlas)
7. [Endpoints de la API (Backend Express)](#-endpoints-de-la-api-backend-express)
8. [Operación Segura, Backups Cifrados y Monitoreo](#-operación-segura-backups-cifrados-y-monitoreo)
9. [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
10. [Exportación del Código en Markdown](#-exportación-completa-del-código-en-markdown)

---

## 🌟 Visión General

**SebastianG** es un ecosistema completo para estudios y fotógrafos profesionales que automatiza todo el ciclo de vida del cliente:
- **Atracción**: Exhibición editorial de portafolio con transiciones cinematográficas.
- **Conversión**: Agendamiento en 3 pasos con cálculo dinámico de fotos extra, retablos e impresiones.
- **Entrega Segura**: Galería privada con marca de agua en diagonal, lienzo protegido contra clics derechos, capturas e inspección de código.
- **Cobro & Monetización**: Integración directa con pasarelas colombianas (**Nequi, DaviPlata, Dale!**) y validación de comprobantes.
- **Control Financiero**: Rastreo en tiempo real de lo que el fotógrafo paga al taller de retablos vs. lo que cobra al cliente vs. la ganancia limpia.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | React 18, Vite 6, Tailwind CSS v4, Lucide React, Canvas Confetti |
| **Backend & API** | Node.js, Express, Multer, Nodemailer, Sharp |
| **Persistencia Cloud** | MongoDB Atlas (Fuente Única de Verdad, 11 índices BSON, TTL nativo 90d) |
| **Persistencia Local / Offline** | IndexedDB, LocalStorage, Runtime JSON DB |
| **Documentos & Comprobantes** | jsPDF (vectorial), html2canvas, QRCode |
| **Notificaciones** | OneSignal Web Push SDK, Web Push API, Service Workers, Audio Chimes |
| **Desktop App** | Electron 41, Electron Builder (Instalador NSIS para Windows) |

---

## 📂 Estructura del Proyecto

```text
foto-reservas/
├── api/
│   ├── db/
│   │   └── mongo.js                # Conexión persistente y gestión de 11 índices BSON (TTL nativo 90d)
│   ├── payments/
│   │   └── gateway.js              # Pasarela Wompi con firma SHA-256 e idempotencia
│   ├── emailService.js             # Envío de notificaciones por correo vía Nodemailer (Zoho SMTP)
│   ├── passwordReset.js            # Recuperación segura con código OTP efímero y quema por reintento
│   ├── security.js                 # Autenticación scrypt, tokens APK revocables, cifrado AES-256-GCM con keyId
│   └── index.js                    # Servidor Express serverless con rutas API para Vercel
├── docs/
│   ├── OPERATIONS_AND_INCIDENT_RUNBOOK.md # Manual de respuesta a incidentes, RPO/RTO y arquitectura móvil
│   └── legacy/                     # Archivos históricos deprecados (esquemas y scripts de migración)
├── electron/
│   ├── main.cjs                    # Proceso principal de Electron para la versión de escritorio
│   └── preload.cjs                 # Script de precarga seguro para IPC de Electron
├── public/
│   ├── app-icon.png                # Icono oficial de la aplicación
│   ├── catalog/                    # Imágenes estáticas y de muestra del catálogo
│   └── logos-perfil/               # Variaciones de logo en alta definición
├── scripts/
│   ├── run-incident-drill.mjs      # Simulacro operacional automatizado en infraestructura real (Atlas)
│   ├── check-syntax.js             # Validador sintáctico estricto de todos los módulos backend
│   └── export-project-markdown.js  # Consolidador de todo el código fuente en archivo .md
├── src/
│   ├── assets/
│   │   └── logoWatermark.js        # Constantes vectoriales de logomarcas para agua y PDFs
│   ├── components/
│   │   ├── AboutSection.jsx        # Sección sobre el fotógrafo y biografía
│   │   ├── AdminPanel.jsx          # Panel de administración completo (Agenda, Costos, Pagos, VIP, Métricas)
│   │   ├── BookingCalendar.jsx     # Selector de fechas y calendario
│   │   ├── BookingModal.jsx        # Modal interactivo de reservas en 3 pasos
│   │   ├── Catalog.jsx             # Galería visual del portafolio fotográfico
│   │   ├── ClientGallery.jsx       # Galería privada del cliente con selección protegida
│   │   ├── ErrorBoundary.jsx       # Manejo de fallos en renderizado de React
│   │   ├── InteractiveLogoIntro.jsx# Pantalla de bienvenida con animación interactiva
│   │   ├── MobileStickyBookingBar.jsx # Barra inferior flotante para agendamiento rápido en móviles
│   │   ├── Navbar.jsx              # Barra de navegación principal y accesos rápidos
│   │   ├── PackagesSection.jsx     # Exhibición de paquetes de fotos, impresiones y retablos
│   │   ├── PaymentLogos.jsx        # Componentes visuales oficiales de Nequi, DaviPlata y Dale!
│   │   ├── ProtectedCanvasImage.jsx# Renderizado sobre Canvas con prevención de descargas no autorizadas
│   │   ├── PublicReceiptView.jsx   # Vista web pública del comprobante de pago con QR
│   │   ├── PublicReviewView.jsx    # Módulo de calificación y reseñas de clientes
│   │   ├── SecurityOverlay.jsx     # Protección contra capturas y herramientas de desarrollador
│   │   ├── SocialIcons.jsx         # Iconografía de redes sociales oficiales
│   │   └── TestimonialsSection.jsx # Sección de opiniones y testimonios de clientes
│   ├── services/
│   │   ├── analytics.js            # Registro de eventos y métricas de navegación
│   │   ├── api.js                  # Biblioteca central de llamadas API, catálogo, cálculos y utilidades
│   │   ├── biometrics.js           # Soporte para WebAuthn / Huella dactilar en panel admin
│   │   ├── bookingAvailability.js  # Motor de cálculo de horas y bloqueo de turnos ocupados
│   │   ├── envelopeCrypto.js       # Cifrado local de credenciales sensibles
│   │   ├── indexedDb.js            # Almacén estructurado offline para fotos e historial
│   │   ├── notifications.js        # Despachador de notificaciones locales y sonoras
│   │   ├── onesignal.js            # Cliente OneSignal Push en tiempo real
│   │   ├── receiptPdfGenerator.js  # Generador de recibos vectoriales de lujo en formato PDF
│   │   └── systemAuditor.js        # Auditor de integridad del sistema y diagnóstico
│   ├── App.jsx                     # Componente raíz con rutas, estados globales y navegación
│   ├── main.jsx                    # Punto de entrada de React en el DOM
│   └── style.css                   # Estilos globales y reglas de Tailwind
├── index.html                      # Plantilla HTML5 con metadatos PWA y tipografías
├── package.json                    # Dependencias y scripts de compilación (npm test, npm run ops:drill)
├── vercel.json                     # Configuración de despliegue, CSP estricto y reescritura en Vercel
└── vite.config.js                  # Configuración de empaquetado con Vite y plugins
```

---

## 💰 Catálogo Oficial de Tarifas y Servicios

### 1. Paquetes de Sesiones
- **Paquete Básico**: 8 fotos editadas (+2 gratis) = **\$75.000 COP**
- **Paquete Familiar / Exterior**: 15 fotos editadas = **\$130.000 COP**
- **Paquete Premium / Estudio**: 25 fotos editadas = **\$200.000 COP**
- **Foto Extra Digital Adicional**: **\$8.000 COP** c/u
- **Recargo por Sesión Fuera de San Antero**: **\$10.000 COP**

### 2. Fotos Impresas en Papel (Laboratorio)
Copias impresas en papel fotográfico de alta durabilidad:
- **10x15 cm**: **\$7.000 COP**
- **15x20 cm**: **\$8.000 COP**

### 3. Cuadros en Retablos de Madera (Costos y Ganancias)
Cuadros en retablo de madera con cantos biselados y película protectora UV listos para colgar:

| Medida Retablo | 🛒 Lo que pago (Taller) | 🏷️ A precio mío (Cobro al cliente) | 💰 Mi ganancia limpia | % Margen |
|---|:---:|:---:|:---:|:---:|
| **20x30 cm** | \$15.000 COP | \$30.000 COP | **+\$15.000 COP** | **50%** |
| **30x45 cm** | \$30.000 COP | \$60.000 COP | **+\$30.000 COP** | **50%** |
| **40x50 cm** | \$55.000 COP | \$85.000 COP | **+\$30.000 COP** | **35%** |
| **50x70 cm** | \$80.000 COP | \$110.000 COP | **+\$30.000 COP** | **27%** |
| **70x50 cm** | \$80.000 COP | \$120.000 COP | **+\$40.000 COP** | **33%** |
| **70x100 cm** (1m) | \$150.000 COP | \$200.000 COP | **+\$50.000 COP** | **25%** |

---

## 🧩 Módulos del Sistema

### 1. Landing Page & Catálogo Público
- Cabecera con menú responsivo y acceso al panel administrativo.
- Muestrario fotográfico clasificado por temáticas (Bodas, Grados, Cumpleaños, Retratos, Playa).
- Vista previa optimizada con miniaturas y carga progresiva.

### 2. Motor de Reservas & Agenda Inteligente
- Selector de fecha y hora que bloquea automáticamente horarios ocupados.
- Desglose independiente de fotos en papel y de cuadros en retablos.
- Generación de confirmación instantánea vía mensaje formateado de WhatsApp.

### 3. Galería Privada del Cliente & Selección Protegida
- Acceso por token privado único (`/gallery/:token`).
- Marca de agua dinámica con nombre y sellos de seguridad sobre canvas HTML5.
- Selección en vivo sincronizada con el panel administrativo.
- Contador de fotos incluidas en su paquete vs. fotos adicionales a facturar.

### 4. Pasarelas Móviles & Comprobantes de Pago
- Cuentas activas con copia de número en un toque:
  - **Nequi**: `3244725167`
  - **DaviPlata**: `@PLATA3244725167`
  - **Dale!**: `@SGG04`
- Carga de fotografía del comprobante de transferencia bancaria.

### 5. Generador de Recibos PDF de Lujo con QR
- Renderizado vectorial de alta precisión mediante `jsPDF`.
- Código QR que redirige a la verificación pública web del comprobante.
- Detalle contable separado para fotos de sesión, fotos impresas y cuadros en retablo.
- Función de descarga directa, impresión física y compartir por WhatsApp.

### 6. Dashboard Administrativo (POS) & Inteligencia de Negocio
- Acceso autenticado mediante PIN de 6 dígitos + opción 2FA / Biometría.
- **Control de Costos de Retablos**: Tabla ejecutiva que calcula automáticamente los costos de taller, precios cobrados y utilidades netas acumuladas en las reservas.
- **Gestión de Agenda**: Confirmación, reagendamiento, cancelación y auto-abono rápido del 50%.
- **Historial de Pagos**: Verificación de comprobantes adjuntos, anulación de pagos y filtros por pasarela.
- **Clientes VIP**: Reconocimiento de clientes frecuentes y estadísticas de consumo.

### 7. Sistema de Notificaciones Push 24/7
- Integración de OneSignal para notificar al fotógrafo de nuevas reservas o selecciones en segundo plano.
- Campanas sonoras y parpadeo del título de la pestaña del navegador.

---

## 🗄️ Base de Datos y Persistencia Oficial en MongoDB Atlas

**MongoDB Atlas es la única fuente de verdad persistente (Single Source of Truth) del sistema.**
(Los esquemas y scripts históricos de Supabase fueron retirados de producción y archivados como referencia bajo `docs/legacy/`).

El backend administra automáticamente **11 índices BSON de alto rendimiento** (gestionados en [`api/db/mongo.js`](api/db/mongo.js)):
- **`bookings`**: `id` (único), `dateTime + status` (prevención de solapamiento de horarios), `createdAt`.
- **`payments`**: `id` (único), `bookingId`, `reference` (detección de pagos duplicados e idempotencia Wompi).
- **`sessions`**: `id` (único), `token` (único, galerías privadas), `expiresAt`.
- **`audit_logs`**: `id` (único) e **índice TTL nativo de 90 días** `idx_audit_logs_ttl_90d` (`{ expiresAtDate: 1 }`, `expireAfterSeconds: 0`), garantizando la purga automática de auditorías financieras sin consumo de almacenamiento innecesario.

---

## 🔌 Endpoints de la API (Backend Express)

| Método | Endpoint | Alcance / Permiso | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verificación de estado del servidor y conectividad con MongoDB Atlas |
| `GET` | `/api/public/schedule` | Público | Consulta de agenda de turnos ocupados (sin exposición de PII) |
| `POST`| `/api/bookings` | Público / Rate Limit | Creación de reserva con validación de horario no solapado |
| `POST`| `/api/payments/checkout` | Público / Rate Limit | Inicio de sesión de pago Wompi ($20.000 COP abono oficial) |
| `POST`| `/api/payments/webhook` | Externo firmado (Wompi) | Procesamiento idempotente de eventos con validación de checksum SHA-256 |
| `GET` | `/api/public/receipt/:token` | Público firmado | Consulta y descarga de recibo electrónico oficial con QR |
| `GET` | `/api/gallery/:token` | Clientes por token | Galería privada (marca de agua dinámica; 0 fotos expuestas si expiró) |
| `POST`| `/api/gallery/:token/submit` | Clientes por token | Confirmación de selección fotográfica |
| `GET` | `/api/apk/feed` | Token APK (`apk_feed:read`)| Feed liviano para la app Android del fotógrafo (revocable en cada petición) |
| `POST`| `/api/admin/pin/login` | Público / Rate Limit | Autenticación administrativa mediante scrypt (N=16384) |
| `POST`| `/api/admin/password/reset-request` | Público / Rate Limit | Envío de OTP efímero exclusivamente a `ADMIN_EMAIL` vía Zoho SMTP |
| `POST`| `/api/admin/password/reset-confirm` | Público / Rate Limit | Validación de OTP, quema por reintentos e incremento de `passwordVersion` |
| `GET` | `/api/admin/backup?encrypt=1` | Admin | Exportación de backup cifrado en `AES-256-GCM` con versionado `keyId` |
| `POST`| `/api/admin/backup/restore` | Admin | Restauración con recreación de índices y medición de RTO por fases |
| `GET` | `/api/admin/monitoring/status` | Admin | Reporte de estado operativo, contadores y métricas en caliente |
| `POST`| `/api/admin/monitoring/test-alert` | Admin | Simulacro mensual de alertas vía OneSignal Push y Webhook externo |

---

## 🛡️ Operación Segura, Backups Cifrados y Monitoreo

Para más detalles sobre la respuesta ante incidentes (pérdida de celular APK, discrepancias financieras o caídas de clúster), consulta el documento oficial:
👉 **[`docs/OPERATIONS_AND_INCIDENT_RUNBOOK.md`](docs/OPERATIONS_AND_INCIDENT_RUNBOOK.md)**

Para ejecutar el simulacro automatizado de extremo a extremo en infraestructura real (rotación de claves, revocación APK, checkout Wompi, backup/restore con índices TTL en base temporal de MongoDB Atlas y disparo de alertas):
```bash
npm run ops:drill
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 18+ instalado.
- Gestor de paquetes `npm`.

### Comandos de Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo frontend (Vite)
npm run dev

# 3. Iniciar servidor completo (Frontend + Backend local)
npm run dev:all

# 4. Compilar proyecto para producción
npm run build

# 5. Ejecutar versión de escritorio con Electron
npm run electron

# 6. Generar instalador de Windows (.exe NSIS)
npm run electron:build
```

---

## 📦 Exportación Completa del Código en Markdown

El proyecto incluye una herramienta que empaqueta todo el código fuente de los archivos en un único documento Markdown (`PROJECT_SOURCE_CODE.md`):

```bash
node scripts/export-project-markdown.js
```

Genera el archivo con el árbol de archivos y los bloques de código delimitados por sintaxis para respaldos, auditorías o consultas completas.
