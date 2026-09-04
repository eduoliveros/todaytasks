# 009. Arquitectura de Internacionalización (i18n) Multilingüe y Rollout Progresivo

* **Fecha:** 2026-09-03
* **Estado:** Aceptado

## Contexto
TodayTasks fue concebida inicialmente con todos los textos, formatos y avisos hardcodeados en español (`lang="es"`). Con más de 550 cadenas de texto visibles distribuidas a lo largo de 25 archivos (HTML y módulos JavaScript), surge la necesidad de internacionalizar la aplicación para soportar español e inglés como idiomas iniciales, manteniendo la arquitectura abierta para la incorporación ágil de idiomas adicionales.

El desafío radicaba en implementar este soporte sin violar los principios fundacionales del repositorio:
1. No introducir bundlers ni dependencias npm pesadas en tiempo de ejecución (Vanilla JS nativo con ES Modules).
2. Evitar regresiones o roturas en la suite de más de 40 suites de tests y pruebas E2E.
3. Permitir una migración granular que no obligue a reescribir toda la aplicación en un solo cambio de alto riesgo.

## Decisión
Se decidió implementar un sistema de internacionalización propio, ligero y desacoplado, estructurado de la siguiente forma:

1. **Motor Propio (`js/i18n.js`):**
   - Una API concisa compuesta por `t(key, params)`, `tPlural(key, count, params)`, `setLocale(locale)`, `getLocale()` y `translateDOM(container)`.
   - Soporte para interpolación de parámetros mediante formato `{variable}` y pluralización `{ one, other }`.
   - Atributos declarativos en el DOM (`data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria`) para traducir elementos estáticos sin alterar el marcado estructural.

2. **Estrategia de Fallback y Resiliencia:**
   - Si una clave solicitada no existe en el idioma activo (o mientras la migración de un archivo esté en progreso), el motor resuelve transparentemente la clave desde el diccionario base en español (`es`), evitando textos vacíos o fallos en tiempo de ejecución.

3. **Detección y Persistencia:**
   - Detección automática mediante `navigator.language`: si el navegador comienza por `es`, se establece `es`; en cualquier otro caso, se establece `en`.
   - Persistencia de la selección explícita del usuario en `state.language`, sincronizada en `localStorage` y Firebase Firestore.
   - Selector accesible en la pestaña de Configuración (`#languageSelect`).

4. **Tratamiento de Casos Especiales:**
   - **Parseo de duraciones (`parseDuration`):** Registro de patrones de expresiones regulares por idioma (`DURATION_PATTERNS[locale]`).
   - **Búsqueda inteligente:** Indexación simultánea de tokens bilingües en `getTaskSearchableText()`.

5. **Rollout por Fases (6 Etapas):**
   - La implementación se planifica en 6 fases independientes (Infraestructura → DOM Estático → Utilidades/Fechas → Vistas Principales/PiP → Triaje/Histórico/Horario → Acciones/Diálogos), asegurando validación continua con `npm test`.

## Consecuencias
* **Positivas:**
  - Cero dependencias externas o impacto en el rendimiento de carga.
  - La aplicación puede operar en modo bilingüe de forma gradual sin riesgo de rotura.
  - La incorporación de futuros idiomas se reduce a la creación de un único archivo `js/i18n/<lang>.js` y su registro en el selector.
* **Negativas / Compensaciones:**
  - Requiere mantener la sincronía de claves entre los diccionarios `es.js` y `en.js`.
  - La migración de los ~550 strings a lo largo de 24 archivos JS requiere un esfuerzo de sustitución metódico en el código fuente.

Para la especificación completa, consultar [docs/I18N_SPECIFICATION.md](../I18N_SPECIFICATION.md).
