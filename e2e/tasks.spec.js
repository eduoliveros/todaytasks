import { test, expect } from '@playwright/test';

test.describe('Flujo de Tareas en la Web (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('Crear, editar, ejecutar y completar una tarea desde la UI', async ({ page }) => {
    // Activar modo planificación para asegurar visibilidad en el tablero independientemente de la hora
    await page.click('button[data-tab="tiempo"]');
    await page.click('#planningModeBtn');
    await page.click('button[data-tab="entorno"]');

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

  test('Crear una tarea con Auto-mover a hoy y verificar el badge Pasar a hoy', async ({ page }) => {
    await page.fill('#taskTitle', 'Revisión crítica de contratos');
    await page.fill('#taskDuration', '30');
    // Marcar checkbox "Auto-mover si no se completa a hoy"
    await page.check('#isAutoMoveTaskCheckbox');
    await page.click('#addTaskBtn');

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Revisión crítica de contratos');
    await expect(tasksList.locator('.tag-automove')).toContainText('Pasar a hoy');
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

  test('Navegar entre días usando las flechas de fecha en Panel 2 Tiempo', async ({ page }) => {
    // Cambiar al panel Tiempo
    await page.click('button[data-tab="tiempo"]');

    const datePicker = page.locator('#datePickerInput');
    const initialDate = await datePicker.inputValue();
    expect(initialDate).toBeTruthy();

    // Click en retroceder día (flecha izquierda)
    await page.click('#prevDayBtn');

    const prevDate = await datePicker.inputValue();
    expect(prevDate).not.toBe(initialDate);

    // Botón hoy debe aparecer cuando no estamos en hoy
    const todayBtn = page.locator('#todayBtn');
    await expect(todayBtn).toBeVisible();

    // Click en avanzar día (flecha derecha)
    await page.click('#nextDayBtn');

    const nextDate = await datePicker.inputValue();
    expect(nextDate).toBe(initialDate);
    await expect(todayBtn).toBeHidden();
  });

  test('Pulsar la tecla "d" activa el panel Tiempo y resetea la fecha a hoy', async ({ page }) => {
    await page.click('button[data-tab="tiempo"]');
    const datePicker = page.locator('#datePickerInput');
    const todayDateStr = await datePicker.inputValue();

    await page.click('#prevDayBtn');
    const prevDateStr = await datePicker.inputValue();
    expect(prevDateStr).not.toBe(todayDateStr);

    await page.click('button[data-tab="entorno"]');
    await expect(page.locator('#htab-entorno')).toHaveClass(/active/);

    await page.keyboard.press('d');

    await expect(page.locator('#htab-tiempo')).toHaveClass(/active/);
    expect(await datePicker.inputValue()).toBe(todayDateStr);
    await expect(page.locator('#todayBtn')).toBeHidden();
  });

  test('Abrir ventana de foco con botón ◎ Foco [F] y tecla "f"', async ({ page }) => {
    await page.fill('#taskTitle', 'Tarea en Foco E2E');
    await page.fill('#taskDuration', '25');
    await page.click('#addTaskBtn');

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Tarea en Foco E2E');

    // 1. Iniciar la tarea para que aparezca el botón de foco en marcha
    await page.click('#tasksList .btn.run');
    const focusBtn = tasksList.locator('.focus-link');
    await expect(focusBtn).toBeVisible();

    // Click en botón ◎ Foco [F]
    await focusBtn.click();

    const viewTask = page.locator('#view-task');
    await expect(viewTask).toBeVisible();
    await expect(viewTask).toContainText('Tarea en Foco E2E');
    await expect(viewTask.locator('.focus-ring-wrap')).toBeVisible();

    // Volver al tablero con el botón volver
    await page.click('.focus-back');
    await expect(viewTask).toBeHidden();
    await expect(page.locator('#view-main')).toBeVisible();

    // 2. Pulsar la tecla "f" para abrir foco
    await page.keyboard.press('f');
    await expect(viewTask).toBeVisible();
    await expect(viewTask).toContainText('Tarea en Foco E2E');

    // Pulsar "Escape" para volver
    await page.keyboard.press('Escape');
    await expect(viewTask).toBeHidden();
    await expect(page.locator('#view-main')).toBeVisible();
  });
});


