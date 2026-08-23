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
      <input type="number" id="taskDuration" value="" />
      <input type="checkbox" id="isAutoMoveTaskCheckbox" checked />
      <div id="autoMoveTaskOptionWrap"></div>
      <input type="checkbox" id="isRecurringTaskCheckbox" />
      <div id="recurringTaskFormOptions" style="display:none;">
        <select id="recTaskFreq"><option value="weekly">weekly</option><option value="daily">daily</option></select>
        <input type="number" id="recTaskInterval" value="1" />
        <input type="checkbox" class="rec-task-day-cb" value="1" checked />
        <input type="date" id="recTaskEndDate" value="" />
      </div>
      <button class="btn" id="addTaskBtn">Añadir</button>
    `;

    const appCtx = {
      getState: () => state,
      actionsModule: {
        addTask: (title, dur, toTop, recurringData, autoMoveToToday) => {
          addedTasks.push({ title, dur, toTop, recurringData, autoMoveToToday });
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
      expect(addedTasks[0]).toEqual({
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
});
