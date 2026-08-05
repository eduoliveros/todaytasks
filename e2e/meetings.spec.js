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
});
