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

  test('Editar tiempo consumido directamente desde la página principal haciendo clic en el tiempo', async ({ page }) => {
    await page.fill('#taskTitle', 'Tarea Ajuste Tiempo');
    await page.fill('#taskDuration', '40');
    await page.click('#addTaskBtn');

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Tarea Ajuste Tiempo');

    // El tiempo consumido inicial debe ser 0 min y clickable
    const clickableTime = tasksList.locator('.task-duration-clickable');
    await expect(clickableTime).toBeVisible();
    await expect(clickableTime).toHaveText('0 min');

    // Clic en el tiempo consumido abre el popover
    await clickableTime.click();
    const popover = page.locator('#timePopover');
    await expect(popover).toBeVisible();

    // Rellenar nuevo tiempo y guardar
    const input = page.locator('#timePopoverInput');
    await input.fill('25');
    await page.click('#timePopover button:has-text("Guardar")');

    // El popover se cierra y el tiempo consumido se actualiza en la página principal
    await expect(popover).toBeHidden();
    await expect(clickableTime).toHaveText('25 min');
  });

  test('Mover una tarea auto-move de forma individual a otra fecha mediante el botón ➡️ y el modal Mover', async ({ page }) => {
    // 1. Crear tarea con auto-mover
    await page.fill('#taskTitle', 'Tarea Individual AutoMove');
    await page.fill('#taskDuration', '30');
    await page.check('#isAutoMoveTaskCheckbox');
    await page.click('#addTaskBtn');

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Tarea Individual AutoMove');

    // 2. Verificar que el botón es ➡️ (Mover a otro día)
    const moveBtn = tasksList.locator('.icon-btn[title="Mover a otro día"]');
    await expect(moveBtn).toBeVisible();
    await expect(moveBtn).toHaveText('➡️');

    // 3. Abrir modal
    await moveBtn.click();
    const modal = page.locator('#copyTaskModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#copyTaskModalTitle')).toContainText('Mover');
    await expect(page.locator('#copyTaskBtnCustomDate')).toHaveText('Mover');

    // 4. Mover a una fecha futura (dentro de 5 días)
    const futureDate = '2026-08-30';
    await page.fill('#copyTaskDateInput', futureDate);
    await page.click('#copyTaskBtnCustomDate');

    // Comprobar que el modal se cierra y la tarea ya no está en hoy
    await expect(modal).toBeHidden();
    await expect(tasksList).toContainText('Aún no hay tareas.');

    // 5. Navegar a la fecha destino y verificar que la tarea está allí
    await page.click('button[data-tab="tiempo"]');
    await page.fill('#datePickerInput', futureDate);
    await page.dispatchEvent('#datePickerInput', 'change');

    await expect(tasksList).toContainText('Tarea Individual AutoMove');
  });

  test('Mover todas las tareas auto-move en bloque a un día futuro mediante el banner contextual', async ({ page }) => {
    // 1. Crear 2 tareas en el día actual con auto-mover
    await page.fill('#taskTitle', 'Pendiente AutoMove 1');
    await page.fill('#taskDuration', '20');
    await page.check('#isAutoMoveTaskCheckbox');
    await page.click('#addTaskBtn');

    await page.fill('#taskTitle', 'Pendiente AutoMove 2');
    await page.fill('#taskDuration', '35');
    await page.check('#isAutoMoveTaskCheckbox');
    await page.click('#addTaskBtn');

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Pendiente AutoMove 1');
    await expect(tasksList).toContainText('Pendiente AutoMove 2');

    // 2. Navegar al día siguiente (futuro)
    await page.click('button[data-tab="tiempo"]');
    await page.click('#nextDayBtn');

    // En el día siguiente la lista de tareas está vacía pero debe aparecer el banner
    const banner = page.locator('#tasksAutoMoveBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('2 tareas automáticas');

    // 3. Pulsar el botón del banner para traer todas las tareas automáticas en bloque
    await page.click('#tasksAutoMoveBanner .btn-bring');

    // 4. Verificar que ambas tareas se han trasladado al día futuro y el banner desaparece
    await expect(banner).toBeHidden();
    await expect(tasksList).toContainText('Pendiente AutoMove 1');
    await expect(tasksList).toContainText('Pendiente AutoMove 2');
  });

  test('Reordenar tareas con flechas y scroll al iniciar tarea', async ({ page }) => {
    // 1. Crear 3 tareas
    for (let i = 1; i <= 3; i++) {
      await page.fill('#taskTitle', `Tarea Número ${i}`);
      await page.fill('#taskDuration', '25');
      await page.click('#addTaskBtn');
    }

    const tasksList = page.locator('#tasksList');
    await expect(tasksList).toContainText('Tarea Número 1');
    await expect(tasksList).toContainText('Tarea Número 2');
    await expect(tasksList).toContainText('Tarea Número 3');

    // 2. Localizar el botón de subir de la Tarea Número 3
    const task3SubirBtn = tasksList.locator('.task-item:has-text("Tarea Número 3") button[data-action="move-up"]');
    await expect(task3SubirBtn).toBeVisible();

    // Guardar posición del botón en viewport antes del click
    const boxBefore = await task3SubirBtn.boundingBox();
    expect(boxBefore).toBeTruthy();

    // Pulsar subir en Tarea Número 3
    await task3SubirBtn.click();

    // Ahora la Tarea Número 3 debe estar antes que la Tarea Número 2
    const items = tasksList.locator('.task-item .title');
    await expect(items.nth(0)).toHaveText('Tarea Número 1');
    await expect(items.nth(1)).toHaveText('Tarea Número 3');
    await expect(items.nth(2)).toHaveText('Tarea Número 2');

    // 3. Iniciar la Tarea Número 2 (que está al final)
    const task2StartBtn = tasksList.locator('.task-item:has-text("Tarea Número 2") button:has-text("▶ Iniciar")');
    await task2StartBtn.click();

    // La Tarea Número 2 pasa a primera posición y estado "running"
    await expect(items.nth(0)).toHaveText('Tarea Número 2');
    const runningItem = tasksList.locator('.task-item.running');
    await expect(runningItem).toBeVisible();
    await expect(runningItem).toContainText('Tarea Número 2');
  });
});




