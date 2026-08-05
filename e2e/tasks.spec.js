import { test, expect } from '@playwright/test';

test.describe('Flujo de Tareas en la Web (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Crear, editar, ejecutar y completar una tarea desde la UI', async ({ page }) => {
    // 1. Crear nueva tarea
    await page.fill('#taskTitle', 'Diseñar prototipo Figma');
    await page.fill('#taskDuration', '45');
    await page.click('#addTaskBtn');

    // 2. Comprobar que aparece en la lista de tareas y en el tablero
    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Diseñar prototipo Figma');

    const board = page.locator('#boardContent');
    await expect(board).toContainText('Diseñar prototipo Figma');

    // 3. Editar la tarea
    await page.click('#tasksList .icon-btn[title="Editar"]');
    const titleInput = page.locator('#tasksList input[placeholder="Título de la tarea"]');
    await titleInput.fill('Diseñar prototipo Figma V2');
    await page.click('#tasksList button:has-text("Guardar")');

    await expect(tasksList).toContainText('Diseñar prototipo Figma V2');

    // 4. Iniciar ejecución de la tarea (Pulsar el botón ▶ Iniciar)
    await page.click('#tasksList button:has-text("▶ Iniciar")');

    // Verificar badge "en ejecución"
    await expect(tasksList).toContainText('en ejecución');

    // 5. Completar la tarea (Pulsar el botón ✓ Completar)
    await page.click('#tasksList button:has-text("✓ Completar")');

    // Debe desaparecer de la lista de tareas pendientes
    await expect(tasksList).toContainText('Aún no hay tareas.');

    // Y debe aparecer en la sección de tareas completadas de la agenda
    const summaryBody = page.locator('#summaryBody');
    await expect(summaryBody).toContainText('Diseñar prototipo Figma V2');
  });

  test('Borrar una tarea desde la interfaz', async ({ page }) => {
    await page.fill('#taskTitle', 'Tarea temporal');
    await page.click('#addTaskBtn');

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Tarea temporal');

    // Borrar
    await page.click('#tasksList .icon-btn[title="Eliminar"]');

    await expect(tasksList).toContainText('Aún no hay tareas.');
  });
});
