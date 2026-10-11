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
6. [Base de Datos y Supabase](#-base-de-datos-y-sincronización-en-la-nube)
7. [Endpoints de la API (Backend Express)](#-endpoints-de-la-api-backend-express)
8. [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
9. [Exportación del Código en Markdown](#-exportación-completa-del-código-en-markdown)

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
| **Persistencia Cloud** | Supabase (PostgreSQL, Realtime, Storage) |
| **Persistencia Local / Offline** | IndexedDB, LocalStorage, Runtime JSON DB |
| **Documentos & Comprobantes** | jsPDF (vectorial), html2canvas, QRCode |
| **Notificaciones** | OneSignal Web Push SDK, Web Push API, Service Workers, Audio Chimes |
| **Desktop App** | Electron 41, Electron Builder (Instalador NSIS para Windows) |

---

## 📂 Estructura del Proyecto

```text
foto-reservas/
├── api/
│   ├── emailService.js             # Envío de notificaciones por correo vía Nodemailer
│   └── index.js                    # Servidor Express serverless con rutas API para Vercel
├── electron/
│   ├── main.cjs                    # Proceso principal de Electron para la versión de escritorio
│   └── preload.cjs                 # Script de precarga seguro para IPC de Electron
├── public/
│   ├── app-icon.png                # Icono oficial de la aplicación
│   ├── catalog/                    # Imágenes estáticas y de muestra del catálogo
│   └── logos-perfil/               # Variaciones de logo en alta definición
├── scripts/
│   ├── export-project-markdown.js  # Consolidador de todo el código fuente en archivo .md
│   ├── generate-favicons.js        # Generador de favicons e iconos PWA
│   └── installer.ps1               # Script de instalación para entorno Windows
├── server/
│   ├── data/db.json                # Base de datos local JSON de respaldo
│   └── index.js                    # Servidor local Express alternativo para modo standalone
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
│   │   ├── supabase.js             # Inicialización y cliente Supabase Cloud
│   │   └── systemAuditor.js        # Auditor de integridad del sistema y diagnóstico
│   ├── App.jsx                     # Componente raíz con rutas, estados globales y navegación
│   ├── main.jsx                    # Punto de entrada de React en el DOM
│   └── style.css                   # Estilos globales y reglas de Tailwind
├── index.html                      # Plantilla HTML5 con metadatos PWA y tipografías
├── package.json                    # Dependencias y scripts de compilación
├── supabase_schema.sql             # Esquema DDL para base de datos PostgreSQL en Supabase
├── vercel.json                     # Configuración de despliegue y reescritura de rutas en Vercel
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

## 🗄️ Base de Datos y Sincronización en la Nube

El archivo `supabase_schema.sql` define las tablas en PostgreSQL:
- `bookings`: Registro de reservas, paquetes, fechas, estados y desgloses de impresiones/retablos.
- `payments`: Historial de transacciones, métodos, estados (`pending`/`verified`), comprobantes y referencias.
- `catalog`: Registro de fotos en portafolio y configuraciones del sistema (`system_settings`).
- `vip_clients`: Base de datos de clientes recurrentes.

---

## 🔌 Endpoints de la API (Backend Express)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/settings` | Obtener configuraciones, tarifas y costos vigentes |
| `POST` | `/api/settings` | Actualizar tarifas, costos de retablos y recargos |
| `GET` | `/api/bookings` | Listar todas las reservas registradas |
| `POST` | `/api/bookings` | Crear una nueva reserva desde la web o el panel |
| `PUT` | `/api/bookings/:id` | Modificar estado o datos de una reserva |
| `DELETE`| `/api/bookings/:id` | Eliminar una reserva |
| `GET` | `/api/payments` | Obtener historial de pagos y transferencias |
| `POST` | `/api/payments` | Registrar un nuevo pago con comprobante |
| `PUT` | `/api/payments/:id` | Cambiar estado de verificación de un pago |
| `GET` | `/api/gallery/:token` | Cargar información de la galería privada del cliente |
| `POST` | `/api/gallery/:token/live-selection` | Sincronizar selección de fotos en tiempo real |
| `POST` | `/api/gallery/:token/submit` | Confirmar y cerrar selección de fotos del cliente |
| `POST` | `/api/push/send` | Disparar notificación push al dispositivo del administrador |

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
