import { test, expect } from '@playwright/test';

test.describe('Flujo de Reuniones en la Web (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Limpiar localStorage antes de cada prueba para tener estado limpio
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Crear, editar y eliminar una reunión puntual', async ({ page }) => {
    // 1. Rellenar formulario de nueva reunión
    await page.fill('#meetingTitle', 'Sincro de Proyecto');
    await page.fill('#meetingStart', '10:00');
    await page.fill('#meetingEnd', '11:00');
    await page.click('#addMeetingBtn');

    // 2. Comprobar que aparece en el listado visual
    const meetingsList = page.locator('#meetingsList');
    await expect(meetingsList).toContainText('Sincro de Proyecto');
    await expect(meetingsList).toContainText('10:00');
    await expect(meetingsList).toContainText('11:00');

    // 3. Hacer clic en el botón de Editar (icono ✎)
    await page.click('#meetingsList .icon-btn[title="Editar"]');

    // 4. Modificar el título en el input de edición inline
    const titleInput = page.locator('#meetingsList input[placeholder="Título de la reunión"]');
    await titleInput.fill('Sincro de Proyecto (Urgente)');

    // Guardar cambios
    await page.click('#meetingsList button:has-text("Guardar")');

    // 5. Verificar que se actualizó en la pantalla
    await expect(meetingsList).toContainText('Sincro de Proyecto (Urgente)');

    // 6. Eliminar la reunión
    await page.click('#meetingsList .icon-btn[title="Eliminar"]');

    // 7. Verificar que la lista queda vacía
    await expect(meetingsList).toContainText('Aún no hay reuniones.');
  });

  test('Crear una reunión recurrente y manipularla con el modal de recurrencia', async ({ page }) => {
    // 1. Marcar checkbox de repetición
    await page.check('#isRecurringCheckbox');
    await page.selectOption('#recFreq', 'daily'); // Cambiar a Frecuencia Diaria para que aplique siempre
    await page.fill('#meetingTitle', 'Daily Scrum Recurrente');
    await page.fill('#meetingStart', '09:00');
    await page.fill('#meetingEnd', '09:30');
    await page.click('#addMeetingBtn');

    // 2. Verificar que se renderiza con el badge 🔁 Recurrente
    const meetingsList = page.locator('#meetingsList');
    await expect(meetingsList).toContainText('Daily Scrum Recurrente');
    await expect(meetingsList).toContainText('Recurrente');

    // 3. Intentar eliminar la reunión recurrente -> Abre modal #recurringModal
    await page.click('#meetingsList .icon-btn[title="Eliminar"]');

    // Verificar que el modal es visible
    const modal = page.locator('#recurringModal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Eliminar "Daily Scrum Recurrente"');

    // 4. Pulsar botón "Solo esta ocurrencia"
    await page.click('#recModalBtnInstance');

    // 5. Confirmar que en el día actual ya no está
    await expect(meetingsList).toContainText('Aún no hay reuniones.');
  });

  test('Pulsar una reunión en el calendario hace scroll hasta su tarjeta y activa el resaltado', async ({ page }) => {
    // 1. Crear reunión
    await page.fill('#meetingTitle', 'Reunión con Cliente');
    await page.fill('#meetingStart', '11:00');
    await page.fill('#meetingEnd', '12:00');
    await page.click('#addMeetingBtn');

    // 2. Localizar el slot interactivo en el calendario
    const slot = page.locator('#boardContent .slot-meeting:has-text("Reunión con Cliente")');
    await expect(slot).toBeVisible();
    await expect(slot).toHaveClass(/slot-interactive/);

    // 3. Pulsar sobre el slot
    await slot.click();

    // 4. La tarjeta de reunión en la lista debe recibir highlight-pulse
    const meetingItem = page.locator('#meetingsList .item:has-text("Reunión con Cliente")');
    await expect(meetingItem).toBeVisible();
    await expect(meetingItem).toHaveClass(/highlight-pulse/);
  });

  test('Pausa automáticamente la tarea activa cuando empieza una reunión', async ({ page }) => {
    // 1. Crear una tarea y ponerla en marcha
    await page.fill('#taskTitle', 'Tarea en progreso');
    await page.fill('#taskDuration', '45');
    await page.click('#addTaskBtn');

    const startBtn = page.locator('#tasksList .task-item').first().locator('button:has-text("Iniciar")');
    await startBtn.click();

    // Comprobar que la tarea está en marcha (botón de pausar visible)
    const pauseBtn = page.locator('#tasksList .task-item').first().locator('button:has-text("Pausar")');
    await expect(pauseBtn).toBeVisible();

    // 2. Crear una reunión que comience a la hora actual
    const now = new Date();
    const startH = String(now.getHours()).padStart(2, '0');
    const startM = String(now.getMinutes()).padStart(2, '0');
    const endH = String((now.getHours() + 1) % 24).padStart(2, '0');

    await page.fill('#meetingTitle', 'Reunión Inmediata');
    await page.fill('#meetingStart', `${startH}:${startM}`);
    await page.fill('#meetingEnd', `${endH}:${startM}`);
    await page.click('#addMeetingBtn');

    // 3. Esperar a que el tick de 3 segundos detecte el inicio de la reunión y pause la tarea
    const resumeBtn = page.locator('#tasksList .task-item').first().locator('button:has-text("Reanudar")');
    await expect(resumeBtn).toBeVisible({ timeout: 10000 });
  });
});

