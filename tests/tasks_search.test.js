import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';

describe('Tasks View - Búsqueda Inteligente de Tareas', () => {
  let state;
  let taskEdit = null;
  let taskSearchQuery = '';
  let tasksView;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tasksList"></div>
    `;

    state = defaultState();
    taskEdit = null;
    taskSearchQuery = '';

    const ctx = {
      getState: () => state,
      getTaskEdit: () => taskEdit,
      getTaskSearchQuery: () => taskSearchQuery
    };

    tasksView = TodayTasksTasksView(ctx);
  });

  it('sin búsqueda activa, renderiza la lista normal de tareas activas', () => {
    state.tasks = [
      { id: '1', title: 'Tarea Uno', planned: 30, status: 'pending', order: 1 },
      { id: '2', title: 'Tarea Dos', planned: 45, status: 'completed', completedAt: 600, actualDuration: 40, order: 2 }
    ];

    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    expect(el.innerHTML).toContain('Tarea Uno');
    // La tarea completada NO se muestra en el flujo normal de tasksList
    expect(el.innerHTML).not.toContain('Tarea Dos');
    expect(el.querySelector('.search-results-info')).toBeNull();
  });

  it('con búsqueda activa, separa claramente tareas activas y tareas completadas que coinciden', () => {
    state.tasks = [
      { id: '1', title: 'Revisar API de facturación', planned: 30, status: 'pending', order: 1 },
      { id: '2', title: 'Diseñar pantalla de login', planned: 45, status: 'running', runningStart: 500, elapsedBefore: 0, order: 2 },
      { id: '3', title: 'Facturación clientes mensual', planned: 60, status: 'completed', completedAt: 700, actualDuration: 55, order: 3 },
      { id: '4', title: 'Comprar café', planned: 15, status: 'pending', order: 4 }
    ];

    taskSearchQuery = 'facturacion';
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    // Debe contener el banner o cabecera de búsqueda
    expect(el.querySelector('.search-results-info')).not.toBeNull();

    // Debe mostrar la sección de activas
    const activeHeading = el.querySelector('.search-section-heading.active-heading');
    expect(activeHeading).not.toBeNull();
    expect(activeHeading.textContent).toContain('Tareas activas (1)');
    expect(el.innerHTML).toContain('Revisar API de facturación');

    // Debe mostrar la sección de completadas
    const completedHeading = el.querySelector('.search-section-heading.completed-heading');
    expect(completedHeading).not.toBeNull();
    expect(completedHeading.textContent).toContain('Tareas completadas (1)');
    expect(el.innerHTML).toContain('Facturación clientes mensual');

    // No debe mostrar las tareas que no coinciden
    expect(el.innerHTML).not.toContain('Diseñar pantalla de login');
    expect(el.innerHTML).not.toContain('Comprar café');
  });

  it('busca con múltiples palabras en cualquier orden e ignora acentos/mayúsculas', () => {
    state.tasks = [
      { id: '1', title: 'Diseño de la Interfaz Gráfica', planned: 30, status: 'pending', order: 1 },
      { id: '2', title: 'Preparar informe técnico', planned: 45, status: 'completed', completedAt: 600, actualDuration: 45, order: 2 }
    ];

    taskSearchQuery = 'grafica diseno'; // Orden inverso y sin acentos
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    expect(el.innerHTML).toContain('Diseño de la Interfaz Gráfica');
    expect(el.innerHTML).not.toContain('Preparar informe técnico');
  });

  it('muestra mensaje informativo cuando no hay tareas activas que coincidan pero sí completadas', () => {
    state.tasks = [
      { id: '1', title: 'Diseño web', planned: 30, status: 'pending', order: 1 },
      { id: '2', title: 'Revisar API de facturación', planned: 45, status: 'completed', completedAt: 600, actualDuration: 45, order: 2 }
    ];

    taskSearchQuery = 'facturacion';
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    expect(el.innerHTML).toContain('Sin tareas activas que coincidan');
    expect(el.innerHTML).toContain('Revisar API de facturación');
  });

  it('muestra mensaje informativo cuando no hay tareas completadas que coincidan pero sí activas', () => {
    state.tasks = [
      { id: '1', title: 'Diseño web', planned: 30, status: 'pending', order: 1 },
      { id: '2', title: 'Revisar API de facturación', planned: 45, status: 'completed', completedAt: 600, actualDuration: 45, order: 2 }
    ];

    taskSearchQuery = 'diseno';
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    expect(el.innerHTML).toContain('Diseño web');
    expect(el.innerHTML).toContain('Sin tareas completadas que coincidan');
  });

  it('muestra mensaje global cuando ninguna tarea activa ni completada coincide', () => {
    state.tasks = [
      { id: '1', title: 'Diseño web', planned: 30, status: 'pending', order: 1 },
      { id: '2', title: 'Revisar API', planned: 45, status: 'completed', completedAt: 600, actualDuration: 45, order: 2 }
    ];

    taskSearchQuery = 'inexistente';
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    expect(el.innerHTML).toContain('No se encontraron tareas que coincidan con "inexistente"');
  });

  it('las tareas completadas en la búsqueda incluyen botones para reabrir y ajustar tiempo', () => {
    state.tasks = [
      { id: 'comp_1', title: 'Tarea Terminada Ayer', planned: 30, status: 'completed', completedAt: 600, actualDuration: 35, order: 1 }
    ];

    taskSearchQuery = 'terminada';
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const el = document.getElementById('tasksList');
    expect(el.querySelector('button[onclick*="app.uncompleteTask(\'comp_1\')"]')).not.toBeNull();
    expect(el.querySelector('button[onclick*="app.openTimePopover(\'comp_1\'"]')).not.toBeNull();
  });
});
