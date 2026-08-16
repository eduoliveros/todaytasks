# Directrices del Proyecto (TodayTasks)

Este archivo define las reglas, contexto y estándares operativos para los agentes que trabajen en este repositorio.

---

## 1. Entorno de Ejecución y Servidor Local

- **Entorno:** El sistema utiliza **Node.js** (v24+) y **npm**. No utilizar Python para levantar servidores locales.
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

- Con cada cambio de funcionalidad importante actualiza la versión en index.html, por ejemplo, de 1.50 a 1.51.
<h1>Tablero del día <span class="app-version">v1.50</span></h1>

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