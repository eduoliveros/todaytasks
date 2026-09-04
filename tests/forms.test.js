import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksForms } from '../js/app/forms.js';

describe('TodayTasksForms - Formularios y Menú de Posición', () => {
  let state;
  let addedTasks;
  let addedMeetings;
  let toastMessages;
  let forms;

  beforeEach(() => {
    vi.useFakeTimers();
    state = defaultState();
    addedTasks = [];
    addedMeetings = [];
    toastMessages = [];

    document.body.innerHTML = `
      <input type="text" id="meetingTitle" value="" />
      <input type="text" id="meetingStart" value="" />
      <input type="text" id="meetingEnd" value="" />
      <input type="checkbox" id="isRecurringCheckbox" />
      <div id="recurringFormOptions" style="display:none;">
        <select id="recFreq"><option value="weekly">weekly</option><option value="daily">daily</option></select>
        <input type="number" id="recInterval" value="1" />
        <input type="checkbox" class="rec-day-cb" value="1" checked />
        <input type="date" id="recEndDate" value="" />
      </div>
      <button id="addMeetingBtn">Añadir Reunión</button>

      <input type="text" id="taskTitle" value="" />
      <input type="text" id="taskDuration" value="" />
      <input type="checkbox" id="isAutoMoveTaskCheckbox" checked />
      <div id="autoMoveTaskOptionWrap"></div>
      <input type="checkbox" id="isRecurringTaskCheckbox" />
      <div id="recurringTaskFormOptions" style="display:none;">
        <select id="recTaskFreq"><option value="weekly">weekly</option><option value="daily">daily</option></select>
        <input type="number" id="recTaskInterval" value="1" />
        <input type="checkbox" class="rec-task-day-cb" value="1" checked />
        <input type="date" id="recTaskEndDate" value="" />
      <input type="time" id="taskStartAfterInput" value="" />
      <button type="button" id="clearTaskStartAfterBtn">✕</button>
      <span id="formAutoMoveBadge">⏩</span>
      <span id="formRecurringBadge" style="display:none;">🔁</span>
      <span id="formStartAfterBadge" style="display:none;"></span>
      <button class="btn" id="addTaskBtn">Añadir</button>
    `;

    const appCtx = {
      getState: () => state,
      actionsModule: {
        addTask: (title, dur, toTop, recurringData, autoMoveToToday, urgency, featured, startAfter) => {
          addedTasks.push({ title, dur, toTop, recurringData, autoMoveToToday, urgency, featured, startAfter });
        },
        addMeeting: (title, start, end, recurringData) => {
          addedMeetings.push({ title, start, end, recurringData });
        }
      },
      showToast: (msg) => {
        toastMessages.push(msg);
      },
      fmt: (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      timeToMinutes: (t) => {
        if (!t) return null;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      }
    };

    forms = TodayTasksForms(appCtx);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Envío de Tareas', () => {
    it('muestra toast si se intenta enviar una tarea sin título', () => {
      forms.handleTaskSubmit();
      expect(toastMessages).toContain('Escribe un título para la tarea.');
      expect(addedTasks).toHaveLength(0);
    });

    it('añade tarea con autoMoveToToday = true por defecto', () => {
      document.getElementById('taskTitle').value = 'Nueva Tarea';
      document.getElementById('taskDuration').value = '25';
      forms.handleTaskSubmit(false);

      expect(addedTasks).toHaveLength(1);
      expect(addedTasks[0]).toMatchObject({
        title: 'Nueva Tarea',
        dur: '25',
        toTop: false,
        recurringData: null,
        autoMoveToToday: true
      });
      expect(document.getElementById('taskTitle').value).toBe('');
      expect(document.getElementById('isAutoMoveTaskCheckbox').checked).toBe(true);
    });

    it('añade tarea con autoMoveToToday = false si se desmarca el checkbox', () => {
      document.getElementById('taskTitle').value = 'Tarea Sin AutoMove';
      document.getElementById('taskDuration').value = '25';
      document.getElementById('isAutoMoveTaskCheckbox').checked = false;
      forms.handleTaskSubmit(false);

      expect(addedTasks).toHaveLength(1);
      expect(addedTasks[0].autoMoveToToday).toBe(false);
      // Tras enviar, se restablece a checked
      expect(document.getElementById('isAutoMoveTaskCheckbox').checked).toBe(true);
    });

    it('añade tarea arriba si toTop = true', () => {
      document.getElementById('taskTitle').value = 'Tarea Urgente';
      forms.handleTaskSubmit(true);

      expect(addedTasks).toHaveLength(1);
      expect(addedTasks[0].toTop).toBe(true);
    });

    it('añade tarea con startAfter y resetea el input y badge del formulario', () => {
      document.getElementById('taskTitle').value = 'Tarea Diferida';
      document.getElementById('taskDuration').value = '30';
      document.getElementById('taskStartAfterInput').value = '16:00';
      document.getElementById('formStartAfterBadge').style.display = 'inline-block';

      forms.handleTaskSubmit(false);

      expect(addedTasks).toHaveLength(1);
      expect(addedTasks[0].startAfter).toBe('16:00');
      expect(document.getElementById('taskStartAfterInput').value).toBe('');
      expect(document.getElementById('formStartAfterBadge').style.display).toBe('none');
    });
  });

  describe('Long-press en botón Añadir Tarea y Menú de Posición', () => {
    it('inicia temporizador y añade clase btn-holding al mantener mousedown', () => {
      const btn = document.getElementById('addTaskBtn');
      document.getElementById('taskTitle').value = 'Tarea con opciones';

      btn.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      expect(btn.classList.contains('btn-holding')).toBe(true);

      // Avanzamos 600ms para disparar el menú
      vi.advanceTimersByTime(600);

      const menu = document.getElementById('addTaskPositionMenu');
      expect(menu).not.toBeNull();
      expect(menu.className).toBe('task-context-menu');
      expect(btn.classList.contains('btn-holding')).toBe(false);

      const items = menu.querySelectorAll('.task-menu-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Añadir al inicio (arriba)');
      expect(items[1].textContent).toContain('Añadir al final (abajo)');
    });

    it('inicia temporizador y abre menú al mantener touchstart en dispositivos móviles', () => {
      const btn = document.getElementById('addTaskBtn');
      document.getElementById('taskTitle').value = 'Tarea en móvil';

      btn.dispatchEvent(new Event('touchstart'));
      expect(btn.classList.contains('btn-holding')).toBe(true);

      vi.advanceTimersByTime(600);

      const menu = document.getElementById('addTaskPositionMenu');
      expect(menu).not.toBeNull();
      expect(menu.className).toBe('task-context-menu');

      // Seleccionar "Añadir al inicio (arriba)"
      const optionTop = menu.querySelectorAll('.task-menu-item')[0];
      optionTop.dispatchEvent(new MouseEvent('click'));

      expect(addedTasks).toHaveLength(1);
      expect(addedTasks[0].title).toBe('Tarea en móvil');
      expect(addedTasks[0].toTop).toBe(true);
      expect(document.getElementById('addTaskPositionMenu')).toBeNull();
    });

    it('cancela holding si se suelta el dedo antes de los 600ms (touchend)', () => {
      const btn = document.getElementById('addTaskBtn');
      document.getElementById('taskTitle').value = 'Tarea rápida';

      btn.dispatchEvent(new Event('touchstart'));
      expect(btn.classList.contains('btn-holding')).toBe(true);

      vi.advanceTimersByTime(300);
      btn.dispatchEvent(new Event('touchend'));

      expect(btn.classList.contains('btn-holding')).toBe(false);
      vi.advanceTimersByTime(400);

      // No se debió abrir el menú
      expect(document.getElementById('addTaskPositionMenu')).toBeNull();
    });

    it('cancela holding en touchcancel y mouseleave', () => {
      const btn = document.getElementById('addTaskBtn');

      btn.dispatchEvent(new Event('touchstart'));
      expect(btn.classList.contains('btn-holding')).toBe(true);
      btn.dispatchEvent(new Event('touchcancel'));
      expect(btn.classList.contains('btn-holding')).toBe(false);

      btn.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      expect(btn.classList.contains('btn-holding')).toBe(true);
      btn.dispatchEvent(new MouseEvent('mouseleave'));
      expect(btn.classList.contains('btn-holding')).toBe(false);
    });

    it('evita submit normal si el click fue consecuencia de un longPress', () => {
      const btn = document.getElementById('addTaskBtn');
      document.getElementById('taskTitle').value = 'Tarea click post longpress';

      btn.dispatchEvent(new Event('touchstart'));
      vi.advanceTimersByTime(600); // Se abre el menú y se activa isLongPress

      // El evento click que el navegador dispara al soltar el dedo
      const clickEv = new MouseEvent('click', { cancelable: true });
      btn.dispatchEvent(clickEv);

      expect(addedTasks).toHaveLength(0); // No debe añadir tarea automáticamente
    });

    it('abre el menú al hacer clic derecho (contextmenu)', () => {
      const btn = document.getElementById('addTaskBtn');
      document.getElementById('taskTitle').value = 'Tarea contextmenu';

      const contextEv = new MouseEvent('contextmenu', { cancelable: true });
      btn.dispatchEvent(contextEv);

      expect(contextEv.defaultPrevented).toBe(true);
      const menu = document.getElementById('addTaskPositionMenu');
      expect(menu).not.toBeNull();
    });

    it('cierra el menú al hacer clic o tap fuera', () => {
      const btn = document.getElementById('addTaskBtn');
      document.getElementById('taskTitle').value = 'Tarea dismiss test';

      btn.dispatchEvent(new MouseEvent('contextmenu'));
      expect(document.getElementById('addTaskPositionMenu')).not.toBeNull();

      vi.advanceTimersByTime(60); // Timeout para registrar clickOutside

      document.dispatchEvent(new MouseEvent('click'));
      expect(document.getElementById('addTaskPositionMenu')).toBeNull();
    });
  });

  describe('Persistencia de event listeners tras translateDOM()', () => {
    it('muestra y oculta las opciones de recurrencia tras llamar a translateDOM()', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { translateDOM, setLocale } = await import('../js/i18n.js');

      const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
      document.documentElement.innerHTML = html;

      const appCtx = {
        getState: () => state,
        actionsModule: { addTask: vi.fn(), addMeeting: vi.fn() },
        showToast: vi.fn()
      };
      forms = TodayTasksForms(appCtx);

      // Simular cambio de idioma que ejecuta translateDOM()
      setLocale('en');
      translateDOM();

      const recTaskCb = document.getElementById('isRecurringTaskCheckbox');
      const recTaskPanel = document.getElementById('recurringTaskFormOptions');

      expect(recTaskPanel.style.display).toBe('none');

      recTaskCb.checked = true;
      recTaskCb.dispatchEvent(new Event('change'));

      expect(recTaskPanel.style.display).toBe('block');

      // Comprobar también el checkbox de reuniones
      const recMeetingCb = document.getElementById('isRecurringCheckbox');
      const recMeetingPanel = document.getElementById('recurringFormOptions');

      expect(recMeetingPanel.style.display).toBe('none');

      recMeetingCb.checked = true;
      recMeetingCb.dispatchEvent(new Event('change'));

      expect(recMeetingPanel.style.display).toBe('block');

      // Desmarcar y comprobar que se oculta
      recMeetingCb.checked = false;
      recMeetingCb.dispatchEvent(new Event('change'));
      expect(recMeetingPanel.style.display).toBe('none');
    });
  });

  describe('Formato Markdown de Notas y Opciones Avanzadas', () => {
    let appCtx;
    let editFieldUpdates;

    beforeEach(() => {
      editFieldUpdates = [];
      appCtx = {
        getState: () => state,
        actionsModule: {
          updateTaskEditField: (field, value) => {
            editFieldUpdates.push({ field, value });
          }
        },
        showToast: vi.fn(),
        fmt: (m) => `${m}`,
        timeToMinutes: () => 0
      };
      forms = TodayTasksForms(appCtx);
    });

    it('insertFormNotesFormat añade prefijo y sufijo al textarea del formulario', () => {
      document.body.innerHTML = `
        <textarea id="taskNotesInput"></textarea>
        <span id="formNotesBadge" style="display:none;"></span>
      `;
      const textarea = document.getElementById('taskNotesInput');
      textarea.value = 'hola mundo';
      textarea.selectionStart = 5;
      textarea.selectionEnd = 10;

      forms.insertFormNotesFormat('**', '**');

      expect(textarea.value).toBe('hola **mundo**');
      expect(document.getElementById('formNotesBadge').style.display).toBe('inline-flex');
    });

    it('insertFormNotesFormat usa "texto" si no hay nada seleccionado', () => {
      document.body.innerHTML = `
        <textarea id="taskNotesInput"></textarea>
        <span id="formNotesBadge" style="display:none;"></span>
      `;
      const textarea = document.getElementById('taskNotesInput');
      textarea.value = '';
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;

      forms.insertFormNotesFormat('*', '*');

      expect(textarea.value).toBe('*texto*');
    });

    it('insertFormNotesLink inserta enlace markdown con prompt', () => {
      document.body.innerHTML = `
        <textarea id="taskNotesInput"></textarea>
        <span id="formNotesBadge" style="display:none;"></span>
      `;
      const textarea = document.getElementById('taskNotesInput');
      textarea.value = 'Mira esto: ';
      textarea.selectionStart = 11;
      textarea.selectionEnd = 11;

      vi.spyOn(window, 'prompt')
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce('Sitio Web');

      forms.insertFormNotesLink();

      expect(textarea.value).toBe('Mira esto: [Sitio Web](https://example.com)');
    });

    it('insertEditNotesFormat aplica formato a notas de edición y actualiza el campo', () => {
      const taskId = 'task-1';
      document.body.innerHTML = `
        <textarea id="task-edit-notes-${taskId}"></textarea>
      `;
      const textarea = document.getElementById(`task-edit-notes-${taskId}`);
      textarea.value = 'clave';
      textarea.selectionStart = 0;
      textarea.selectionEnd = 5;

      forms.insertEditNotesFormat(taskId, '`', '`');

      expect(textarea.value).toBe('`clave`');
      expect(editFieldUpdates).toEqual([{ field: 'notes', value: '`clave`' }]);
    });

    it('insertEditNotesLink inserta enlace en notas de edición', () => {
      const taskId = 'task-2';
      document.body.innerHTML = `
        <textarea id="task-edit-notes-${taskId}"></textarea>
      `;
      const textarea = document.getElementById(`task-edit-notes-${taskId}`);
      textarea.value = '';
      textarea.selectionStart = 0;

      vi.spyOn(window, 'prompt')
        .mockReturnValueOnce('https://docs.org')
        .mockReturnValueOnce('Docs');

      forms.insertEditNotesLink(taskId);

      expect(textarea.value).toBe('[Docs](https://docs.org)');
      expect(editFieldUpdates).toEqual([{ field: 'notes', value: '[Docs](https://docs.org)' }]);
    });

    it('toggleEditNotesPreview alterna entre vista de edición y previsualización markdown', () => {
      const taskId = 'task-3';
      document.body.innerHTML = `
        <textarea id="task-edit-notes-${taskId}" style="display:block;">**negrita**</textarea>
        <div id="task-edit-notes-preview-${taskId}" style="display:none;"></div>
        <button id="btn-preview-edit-${taskId}">👁️</button>
      `;

      // Activar preview
      forms.toggleEditNotesPreview(taskId);
      const preview = document.getElementById(`task-edit-notes-preview-${taskId}`);
      const textarea = document.getElementById(`task-edit-notes-${taskId}`);
      const btn = document.getElementById(`btn-preview-edit-${taskId}`);

      expect(preview.style.display).toBe('block');
      expect(textarea.style.display).toBe('none');
      expect(preview.innerHTML).toContain('<strong>negrita</strong>');
      expect(btn.textContent).toBe('✏️');

      // Volver a modo edición
      forms.toggleEditNotesPreview(taskId);
      expect(preview.style.display).toBe('none');
      expect(textarea.style.display).toBe('block');
      expect(btn.textContent).toBe('👁️');
    });

    it('toggleTaskAdvancedOptions abre y cierra el panel colapsable', () => {
      document.body.innerHTML = `
        <div id="taskAdvancedOptionsWrap" style="display:none;"></div>
        <button id="taskAdvancedToggleBtn" aria-expanded="false"></button>
        <span id="taskAdvancedChevron" style="transform: rotate(0deg);"></span>
      `;
      const wrap = document.getElementById('taskAdvancedOptionsWrap');
      const btn = document.getElementById('taskAdvancedToggleBtn');
      const chevron = document.getElementById('taskAdvancedChevron');

      forms.toggleTaskAdvancedOptions();
      expect(wrap.style.display).toBe('block');
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      expect(chevron.style.transform).toBe('rotate(180deg)');

      forms.toggleTaskAdvancedOptions();
      expect(wrap.style.display).toBe('none');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(chevron.style.transform).toBe('rotate(0deg)');
    });

    it('clearFormStartAfterDirect borra el input y actualiza indicadores', () => {
      document.body.innerHTML = `
        <input type="time" id="taskStartAfterInput" value="14:30" />
        <span id="formStartAfterBadge" style="display:inline-flex;">14:30+</span>
      `;
      forms.clearFormStartAfterDirect();
      expect(document.getElementById('taskStartAfterInput').value).toBe('');
      expect(document.getElementById('formStartAfterBadge').style.display).toBe('none');
    });
  });
});
