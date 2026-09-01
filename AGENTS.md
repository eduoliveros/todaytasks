# Directrices del Proyecto (TodayTasks)

Este archivo define las reglas, contexto y estándares operativos para los agentes que trabajen en este repositorio.

---

## Stack tecnológico
JavaScript Vanilla nativo con ES Modules.

## 1. Entorno de Ejecución y Servidor Local

- **Entorno:** El sistema utiliza **Node.js** (v24+) y **npm**. No utilizar Python para levantar servidores locales.
- **Comandos Autorizados:**
  - Se autoriza la ejecución de cualquier comando `npm` (por ejemplo: `npm test`, `npm run test:e2e`, `npm start`), `npx` (por ejemplo: `npx vitest`, `npx playwright`) y `git` (`git status`, `git diff`, `git log`, etc.) requeridos para el diagnóstico, pruebas o desarrollo en el repositorio.
- **Lanzamiento del Servidor Web:**
  - Debe ejecutarse en el puerto **8080**.
  - Comando principal:
    ```bash
    npm start
    ```
    *(o directamente `node server.js`)*.
- **Gestión de Caché:**
  - El servidor local debe servir los archivos estáticos con cabeceras que deshabiliten la caché (`Cache-Control: no-cache, no-store, must-revalidate` y `Pragma: no-cache`) para garantizar que cualquier cambio en HTML, CSS o JS se refleje de inmediato en el navegador sin almacenar versiones obsoletas.

---

## 2. Versionado Automático de la Aplicación

- Con cada cambio de funcionalidad importante actualiza la versión tanto en `index.html` como en `version.json`:
  - En `index.html`: `<h1>Tablero del día <span class="app-version">v1.94</span></h1>`
  - En `version.json`: `{"version": "v1.94", "updatedAt": 1788277200000}`
- Si se pide una modificación sobre la misma funcionalidad, o un fix de algún bug, NO actualices la versión.

---

## 3. Pruebas y Calidad de Código

- Antes de dar por completada una tarea que modifique la lógica, ejecutar las pruebas unitarias y de integración:
  ```bash
  npm test
  ```
- Para pruebas de extremo a extremo (E2E):
  ```bash
  npm run test:e2e
  ```

- Para nueva funcionalidad siempre añade pruebas unitarias que testeen esta nueva funcionalidad.
- Para correcciones de bugs, siempre crea un test que falle debido al bug antes de implementar la solución (TDD).

## 4. Desarrollo
1. Si es un cambio importante, plantea un plan de implementación y las posibles opciones que existan.
2. No repitas bloque de código, separa en nuevas funciones si es necesario.
3. Manten el repositorio manejable: Considera separar archivos si crecen mucho.
4. Mantén el código limpio y documentado, con comentarios claros y concisos.
5. Mantén actualizado el documento [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) con los cambios estructurales para que sirva de guía a futuros agentes.
6. **Registro de Decisiones de Arquitectura (ADR):** Si se toma una decisión de diseño relevante o cambio estructural no trivial, documéntala en `docs/adr/` (Architecture Decision Records) detallando contexto, alternativas y justificación.
7. **Registro de Cambios (`CHANGELOG.md`):** Al incrementar la versión por una funcionalidad importante, documenta las novedades, mejoras o correcciones en [CHANGELOG.md](./CHANGELOG.md).
8. **Modelo de Datos (`docs/DATA_SCHEMA.md`):** Consulta y respeta la especificación en [docs/DATA_SCHEMA.md](./docs/DATA_SCHEMA.md) antes de añadir o modificar propiedades en el estado, tareas, reuniones o entornos.