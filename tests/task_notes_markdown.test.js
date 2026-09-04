import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderNotesMarkdown, escapeHtml } from "../js/ui.js";
import { getTaskSearchableText, matchesTaskSearch } from "../js/utils.js";
import { defaultState } from "../js/state.js";
import { TodayTasksActions } from "../js/actions.js";

describe("renderNotesMarkdown - Micro-parser de Markdown", () => {
  it("devuelve string vacío si recibe null, undefined o string vacío", () => {
    expect(renderNotesMarkdown(null)).toBe("");
    expect(renderNotesMarkdown(undefined)).toBe("");
    expect(renderNotesMarkdown("")).toBe("");
  });

  it("convierte negritas con asteriscos (**bold**) y guiones bajos (__bold__)", () => {
    expect(renderNotesMarkdown("Texto con **negrita**")).toBe("Texto con <strong>negrita</strong>");
    expect(renderNotesMarkdown("Texto con __negrita doble__")).toBe("Texto con <strong>negrita doble</strong>");
  });

  it("convierte cursivas con asterisco (*italic*) y guion bajo (_italic_)", () => {
    expect(renderNotesMarkdown("Texto con *cursiva*")).toBe("Texto con <em>cursiva</em>");
    expect(renderNotesMarkdown("Texto con _cursiva_")).toBe("Texto con <em>cursiva</em>");
  });

  it("convierte enlaces Markdown explícitos [Texto](https://...)", () => {
    const md = "Ver ticket en [Jira PROJ-123](https://jira.empresa.com/browse/PROJ-123)";
    const html = renderNotesMarkdown(md);
    expect(html).toContain("<a href=\"https://jira.empresa.com/browse/PROJ-123\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"task-note-link\">Jira PROJ-123</a>");
  });

  it("detecta y convierte URLs directas http:// y https://", () => {
    const md = "Documentación en https://github.com/repo y http://sitio.com";
    const html = renderNotesMarkdown(md);
    expect(html).toContain("<a href=\"https://github.com/repo\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"task-note-link\">https://github.com/repo</a>");
    expect(html).toContain("<a href=\"http://sitio.com\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"task-note-link\">http://sitio.com</a>");
  });

  it("convierte saltos de línea \n a etiquetas <br>", () => {
    const md = "Línea 1\nLínea 2\r\nLínea 3";
    expect(renderNotesMarkdown(md)).toBe("Línea 1<br>Línea 2<br>Línea 3");
  });

  it("sanitiza estrictamente contra inyecciones XSS (<script>, onerror, javascript:)", () => {
    const xss1 = "<script>alert(1)</script> **importante**";
    const html1 = renderNotesMarkdown(xss1);
    expect(html1).not.toContain("<script>");
    expect(html1).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html1).toContain("<strong>importante</strong>");

    const xss2 = "<img src=x onerror=alert(1)>";
    const html2 = renderNotesMarkdown(xss2);
    expect(html2).not.toContain("<img");
    expect(html2).toContain("&lt;img src=x onerror=alert(1)&gt;");

    const xss3 = "[Malicioso](javascript:alert(1))";
    const html3 = renderNotesMarkdown(xss3);
    // javascript: no debe convertirse en enlace
    expect(html3).not.toContain("<a href=\"javascript");
  });

  it("renderiza correctamente texto combinado complejo", () => {
    const input = "**Revisión:** PR en [GitHub](https://github.com/repo/pull/1) y consultar https://docs.com\n*Nota:* Urgente.";
    const output = renderNotesMarkdown(input);
    expect(output).toBe("<strong>Revisión:</strong> PR en <a href=\"https://github.com/repo/pull/1\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"task-note-link\">GitHub</a> y consultar <a href=\"https://docs.com\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"task-note-link\">https://docs.com</a><br><em>Nota:</em> Urgente.");
  });
});

describe("Búsqueda con Notas en Tareas", () => {
  it("incluye el contenido de las notas en getTaskSearchableText", () => {
    const task = {
      title: "Desarrollo",
      notes: "Referencia a ticket PROJ-994 y endpoint de auth"
    };
    const text = getTaskSearchableText(task);
    expect(text).toContain("PROJ-994");
    expect(text).toContain("auth");
  });

  it("permite filtrar tareas por texto contenido en sus notas", () => {
    const task = {
      title: "Corregir bug",
      notes: "Afecta a Safari iOS y Chrome mobile"
    };
    expect(matchesTaskSearch(task, "Safari")).toBe(true);
    expect(matchesTaskSearch(task, "chrome")).toBe(true);
    expect(matchesTaskSearch(task, "firefox")).toBe(false);
  });
});

describe("TodayTasksActions - Gestión de Tareas con Notas", () => {
  let actions;
  let state;
  let taskEdit = null;
  let idCounter = 1;

  beforeEach(() => {
    window.alert = vi.fn();
    state = defaultState();
    idCounter = 1;
    taskEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => taskEdit,
      setTaskEdit: (t) => { taskEdit = t; },
      setNotifyState: () => {},
      getNotifyState: () => ({ taskId: null }),
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => "main",
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = TodayTasksActions(ctx);
  });

  it("crea una tarea con notas", () => {
    actions.addTask("Refactorizar API", "45", false, null, true, "days", false, null, "Docs en https://api.com");
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].notes).toBe("Docs en https://api.com");
  });

  it("edita las notas de una tarea individual", () => {
    actions.addTask("Escribir tests", "30", false, null, true, "days", false, null, "Nota inicial");
    const taskId = state.tasks[0].id;

    actions.startEditTask(taskId);
    expect(taskEdit.notes).toBe("Nota inicial");

    actions.updateTaskEditField("notes", "Nota actualizada con **negrita**");
    actions.saveEditTask(taskId);

    expect(state.tasks[0].notes).toBe("Nota actualizada con **negrita**");
  });

  it("guarda notas en tareas recurrentes y las propaga al materializar", () => {
    const recurringData = {
      isRecurring: true,
      freq: "daily",
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      endDate: null,
      notes: "Notas maestras de la recurrencia"
    };

    actions.addTask("Standup Diario", "15", false, recurringData, false, "today", false, null, "Notas maestras de la recurrencia");
    
    expect(state.recurringTasks).toHaveLength(1);
    expect(state.recurringTasks[0].notes).toBe("Notas maestras de la recurrencia");
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].notes).toBe("Notas maestras de la recurrencia");
  });

  it("sincroniza las notas en toda la serie recurrente al editar en modo series", () => {
    const recurringData = {
      isRecurring: true,
      freq: "weekly",
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      endDate: null
    };
    actions.addTask("Reunión semanal", "30", false, recurringData, false, "week", false, null, "Nota v1");
    const task = state.tasks[0];
    const ruleId = state.recurringTasks[0].id;

    taskEdit = {
      id: task.id,
      ruleId: ruleId,
      mode: "series",
      title: "Reunión semanal",
      duration: "30",
      actual: "0",
      notes: "Nota v2 actualizada para toda la serie",
      urgency: "week",
      featured: false
    };

    actions.saveEditTask(task.id);

    expect(state.recurringTasks[0].notes).toBe("Nota v2 actualizada para toda la serie");
    expect(state.tasks[0].notes).toBe("Nota v2 actualizada para toda la serie");
  });
});
