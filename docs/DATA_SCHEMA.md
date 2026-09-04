# Esquema del Modelo de Datos (TodayTasks)

Este documento define la especificación formal del modelo de datos de **TodayTasks**, describiendo todas las entidades, propiedades, tipos, valores por defecto e invariantes del sistema.

---

## 1. Estructura Raíz del Estado (`State`)

El estado global gestionado por [state.js](../js/state.js) y persistido en `localStorage` / Firebase Firestore tiene la siguiente estructura:

```typescript
interface State {
  activeEnv: "work" | "personal";      // Entorno seleccionado actualmente (def: "work")
  selectedDate: string;                 // Fecha en formato "YYYY-MM-DD" (def: día actual; estado de vista local de la sesión activa, no persistido en Firestore)
  environments: {
    work: EnvState;                     // Datos del entorno de Trabajo
    personal: EnvState;                 // Datos del entorno Personal
  };
  notifyIntervalMin: number;            // Intervalo de notificación en minutos (def: 10)
  notifyEnabled: boolean;               // Notificaciones web activadas (def: true)
  autoBreakEnabled: boolean;            // Pausas automáticas activadas (def: true)
  autoBreakIntervalMin: number;         // Minutos de trabajo continuo antes de pausa (def: 60)
  autoBreakDurationMin: number;         // Duración del descanso automático en minutos (def: 10)
  themeMode: "auto" | "light" | "dark"; // Tema visual (def: "auto")
  language: string;                     // Idioma de la interfaz: "es" | "en" (def: según navegador)
  nextId: number;                       // Contador incremental para fallback de IDs (def: 1)

  // Metadatos de sincronización en Firestore:
  _lastUpdatedBy?: string;              // clientId de la sesión que guardó el estado
  _lastUpdatedAt?: number;              // Timestamp Epoch (ms) de la última escritura
}
```

---

## 2. Entorno (`EnvState`)

Cada entorno (`work` y `personal`) aísla por completo sus datos, tareas, reuniones y horarios:

```typescript
interface EnvState {
  name: "Trabajo" | "Personal";
  weeklySchedule: WeeklySchedule | null;      // Horario semanal configurado (o null si usa derivado)
  days: Record<string, DayState>;             // Días detallados ("YYYY-MM-DD"). Retiene últimos 10 días
  history: HistoryEntry[];                    // Métricas agregadas por día. Retiene últimos 40 días
  recurringMeetings: RecurringMeetingRule[];  // Reglas maestras de reuniones periódicas
  recurringTasks: RecurringTaskRule[];        // Reglas maestras de tareas periódicas
  activeInterruption: Interruption | null;    // Interrupción en curso (si la hubiera)
  _deletedRecurringIds?: string[];            // IDs de reglas periódicas eliminadas (tombstones para sync)
}
```

---

## 3. Estado del Día (`DayState`)

Estructura de cada día dentro de `env.days["YYYY-MM-DD"]`:

```typescript
interface DayState {
  tasks: Task[];                       // Lista de tareas del día
  meetings: Meeting[];                 // Reuniones puntuales del día
  interruptions: Interruption[];       // Historial de interrupciones cerradas en el día
  planningMode: boolean;               // Modo planificación activo (def: false)
  hasCustomHours?: boolean;            // Si es true, usa workStart/workEnd específicos en lugar del horario semanal
  workStart?: number;                  // Minuto del día (0..1439, ej: 540 = 09:00)
  workEnd?: number;                    // Minuto del día (0..1439, ej: 1080 = 18:00)
  _deletedIds?: string[];              // IDs de tareas, reuniones o interrupciones eliminadas en este día (tombstones para sync)
}
```

---

## 4. Entidad Tarea (`Task`)

Representa una tarea programada o ejecutada en un día concreto:

```typescript
interface Task {
  id: string;                          // Identificador único (UUID o 'id_N_timestamp')
  title: string;                       // Título o descripción de la tarea
  notes?: string;                      // Notas y enlaces de la tarea en Markdown ligero (**bold**, *italic*, URLs)
  planned: number;                     // Duración estimada en minutos (entero > 0, def: 30)
  order: number;                       // Posición ordinal en la lista del día (1, 2, 3...)
  manualOrder?: number | null;         // Orden manual anclado por el usuario (null = flotante con auto-sort, número = posición fija)
  status: "pending" | "running" | "paused" | "completed"; // Estado de ejecución
  runningStart: number | null;         // Minuto del día (0..1439) en que inició el tramo actual
  runningStartEpoch?: number | null;   // Timestamp ms (Date.now()) para cálculo de alta precisión
  elapsedBefore: number;               // Minutos acumulados en tramos de ejecución anteriores (def: 0)
  completedAt: string | null;          // ISO string o timestamp de cuándo se completó
  actualDuration: number | null;       // Minutos totales consumidos al finalizar la tarea
  urgency: "today" | "days" | "week" | "later"; // Nivel de urgencia / prioridad (def: "days")
  featured: boolean;                   // Tarea destacada en el top del día (máx. 5 por día)
  startAfter?: number | null;          // Minuto del día (0..1439, ej: 960 = 16:00) a partir del cual planificar la tarea
  autoMoveToToday?: boolean;           // Si true, se traslada automáticamente a hoy si queda pendiente
  isRecurring?: boolean;               // true si fue materializada desde una RecurringTaskRule
  ruleId?: string | null;              // ID de la regla de recurrencia de origen
}
```

### Niveles de Urgencia (`urgency`)
1. `"today"`: Para hoy (máxima prioridad de ordenación).
2. `"days"`: Próximos días (prioridad normal / por defecto).
3. `"week"`: Esta semana.
4. `"later"`: Más adelante (baja prioridad).

---

## 5. Entidad Reunión (`Meeting`)

Representa un bloqueo de tiempo fijo en el horario del día:

```typescript
interface Meeting {
  id: string | number;                 // Identificador único
  title: string;                       // Título de la reunión
  start: number;                       // Minuto de inicio del día (0..1439, ej: 600 = 10:00)
  end: number;                         // Minuto de fin del día (start < end <= 1440)
  isRecurring?: boolean;               // true si fue hidratada desde una regla periódica
  ruleId?: string | null;              // ID de la regla de recurrencia asociada
}
```

---

## 6. Reglas de Recurrencia

### 6.1. Tarea Recurrente (`RecurringTaskRule`)
```typescript
interface RecurringTaskRule {
  id: string;                          // 'rec_task_' + ID
  title: string;
  notes?: string;                      // Notas y enlaces de la plantilla periódica
  planned: number;
  freq: "daily" | "weekly" | "monthly";
  interval: number;                    // Cada N días/semanas/meses (def: 1)
  daysOfWeek: number[];                // Días de la semana activos: [1=Lunes ... 7=Domingo]
  startDate: string;                   // Fecha de inicio "YYYY-MM-DD"
  endDate: string | null;              // Fecha límite o null si es indefinida
  exceptions: Record<string, { type: "cancelled" | "modified" }>; // Excepciones por fecha
  urgency: "today" | "days" | "week" | "later";
  featured: boolean;
  startAfter?: number | null;          // Minuto del día (0..1439) a partir del cual planificar
}
```

### 6.2. Reunión Recurrente (`RecurringMeetingRule`)
```typescript
interface RecurringMeetingRule {
  id: string;                          // 'rec_' + ID
  title: string;
  start: number;                       // Minuto de inicio (0..1439)
  end: number;                         // Minuto de fin (0..1439)
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  daysOfWeek: number[];                // [1..7]
  startDate: string;
  endDate: string | null;
  exceptions: Record<string, { type: "cancelled" | "modified" }>;
}
```

---

## 7. Interrupciones (`Interruption`)

Registra períodos no planificados que detienen las tareas en curso:

```typescript
interface Interruption {
  id: string | number;
  title: string;                       // Motivo o descripción de la interrupción
  start: number;                       // Minuto del día de inicio (0..1439)
  startEpoch: number;                  // Timestamp Epoch ms de inicio
  end: number | null;                  // Minuto del día de fin (null si está activa)
  duration: number;                    // Duración total consumida en minutos
}
```

---

## 8. Horario Semanal (`WeeklySchedule`)

Mapea los días de la semana (1 = Lunes a 7 = Domingo) con los bloques laborables:

```typescript
type WeeklySchedule = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, DayScheduleSlot | null>;

interface DayScheduleSlot {
  start: number;                       // Minuto de inicio laboral (ej: 540 = 09:00)
  end: number;                         // Minuto de fin laboral (ej: 1080 = 18:00)
  derived?: boolean;                   // true si se autocalculó a partir del horario de trabajo
}
// Un valor `null` indica día no laborable / cerrado.
```

---

## 9. Historial y Métricas Diarias (`HistoryEntry`)

Instantánea agregada generada por [history.js](../js/history.js) para reportes y gráficas:

```typescript
interface HistoryEntry {
  date: string;                        // "YYYY-MM-DD"
  meetingsTime: number;                // Minutos ocupados por reuniones
  completedTasksTime: number;          // Minutos invertidos en tareas completadas
  uncompletedTasksWorkedTime: number;  // Minutos trabajados en tareas pendientes
  uncompletedTasksNotWorkedTime: number;// Minutos estimados restantes en pendientes
  interruptionsTime: number;           // Minutos perdidos en interrupciones
  effectiveTime: number;               // meetingsTime + completedTasksTime + uncompletedTasksWorkedTime
}
```

---

## 10. Invariantes y Reglas de Integridad

1. **Uso obligatorio de `wrapState(raw)`:** Todo objeto de estado cargado de `localStorage`, recibido de Firestore o creado debe pasar por `wrapState()` para inyectar los *getters/setters proxy* dinámicos (`state.tasks`, `state.meetings`, etc.).
2. **Límite de Destacadas:** Máximo **5 tareas destacadas (`featured: true`)** por día.
3. **Poda de Días Detallados (*Pruning*):** `snapshotAndPrune()` elimina días detallados en `env.days` con más de **10 días de antigüedad** respecto a la fecha actual, preservando su resumen en `env.history`.
4. **Retención de Historial:** `env.history` conserva un máximo de **40 días** ordenados cronológicamente.
5. **IDs Únicos:** Todas las entidades nuevas deben crearse mediante `ctx.newId()` (`crypto.randomUUID()` con fallback `id_N_timestamp`).
