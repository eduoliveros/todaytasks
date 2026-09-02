/* cloud.js — Firebase Cloud sync, autenticación y backup/restore */
import { escapeHtml, escapeAttr, showToast } from './ui.js';
import { defaultState, wrapState } from './state.js';
import { snapshotAndPrune } from './history.js';
import TodayTasksConfig from './config.js';

export function TodayTasksCloud(ctx){
  const {
    getState, setState, setMeetingEdit, setTaskEdit, saveState,
    STORAGE_KEY, syncFormInputsFromState, renderAll
  } = ctx;

  const firebaseConfig = TodayTasksConfig && TodayTasksConfig.firebase;
  let fbAuth = null, fbDb = null, currentUser = null, cloudUnsubscribe = null;
  let applyingRemoteUpdate = false;
  let pushDebounceTimer = null;
  const DEFAULT_DEBOUNCE_MS = 500;
  const clientId = 'c_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

  function getClientId(){
    return clientId;
  }

  function cloudDocRef(uid){
    return fbDb.collection("tableroDia").doc(uid);
  }

  function setSyncStatus(kind, text){
    const el = document.getElementById("syncStatus");
    if(!el) return;
    el.className = "sync-status" + (kind ? " " + kind : "");
    el.textContent = text;
  }

  function pushToCloud(options = {}){
    if (pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
      pushDebounceTimer = null;
    }
    if(!currentUser || !fbDb || applyingRemoteUpdate) return;
    setSyncStatus("saving", "⏳ Guardando en la nube…");
    const cloudPayload = {
      ...getState(),
      _lastUpdatedBy: clientId,
      _lastUpdatedAt: Date.now()
    };
    delete cloudPayload.selectedDate;
    cloudDocRef(currentUser.uid).set(cloudPayload)
      .then(()=> setSyncStatus("", "☁ Sincronizado"))
      .catch(err => {
        console.error("Error guardando en Firestore", err);
        setSyncStatus("error", "⚠ Error al sincronizar");
      });
  }

  function pushToCloudDebounced(delayMs = DEFAULT_DEBOUNCE_MS){
    if(!currentUser || !fbDb || applyingRemoteUpdate) return;
    setSyncStatus("pending", "⏳ Cambios pendientes…");
    if (pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
    }
    pushDebounceTimer = setTimeout(() => {
      pushDebounceTimer = null;
      pushToCloud();
    }, delayMs);
  }

  function flushPendingCloudPush(){
    if (pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
      pushDebounceTimer = null;
      pushToCloud();
    }
  }

    function backupLocalState(){
      try {
        localStorage.setItem(STORAGE_KEY + "_backup", JSON.stringify(getState()));
      } catch(e){
        console.warn("No se pudo guardar la copia de seguridad local", e);
      }
    }

    function restoreLocalBackup(){
      try {
        const raw = localStorage.getItem(STORAGE_KEY + "_backup");
        if(!raw){
          showToast("No se encontró ninguna copia de seguridad local reciente.");
          return false;
        }
        const backupState = JSON.parse(raw);
        setState(wrapState(backupState));
        saveState();
        syncFormInputsFromState();
        renderAll();
        showToast("Copia de seguridad local restaurada con éxito.");
        return true;
      } catch(e){
        showToast("Error al restaurar la copia de seguridad.");
        return false;
      }
    }

    function mergeStates(localRaw, remoteRaw){
      const local = wrapState(localRaw);
      const remote = wrapState(remoteRaw);
      const merged = defaultState();
      merged.activeEnv = local.activeEnv || remote.activeEnv || 'work';
      merged.selectedDate = local.selectedDate || merged.selectedDate;
      merged.themeMode = local.themeMode || remote.themeMode || 'auto';
      merged.notifyIntervalMin = local.notifyIntervalMin || remote.notifyIntervalMin || 10;
      merged.notifyEnabled = (local.notifyEnabled !== undefined) ? local.notifyEnabled : ((remote.notifyEnabled !== undefined) ? remote.notifyEnabled : true);

      ['work', 'personal'].forEach(envKey => {
        const localEnv = (local.environments && local.environments[envKey]) || {};
        const remoteEnv = (remote.environments && remote.environments[envKey]) || {};
        const mergedEnv = merged.environments[envKey];

        mergedEnv.activeInterruption = remoteEnv.activeInterruption || localEnv.activeInterruption || null;

        // Horario semanal: si la nube tiene horario configurado, la nube siempre prevalece por completo (sin mezclar claves locales).
        // Sólo en el caso de que en la nube weeklySchedule sea null o undefined, el horario semanal local gana.
        if (remoteEnv && remoteEnv.weeklySchedule) {
          mergedEnv.weeklySchedule = JSON.parse(JSON.stringify(remoteEnv.weeklySchedule));
        } else if (localEnv && localEnv.weeklySchedule) {
          mergedEnv.weeklySchedule = JSON.parse(JSON.stringify(localEnv.weeklySchedule));
        } else {
          mergedEnv.weeklySchedule = null;
        }

        // Merge days objects
        mergedEnv.days = {};
        const allDates = new Set([
          ...Object.keys(localEnv.days || {}),
          ...Object.keys(remoteEnv.days || {})
        ]);

        const allRemoteTaskIds = new Set();
        const allRemoteDeletedIds = new Set();
        Object.values(remoteEnv.days || {}).forEach(d => {
          (d.tasks || []).forEach(t => {
            if (t && t.id != null) allRemoteTaskIds.add(String(t.id));
          });
          (d._deletedIds || []).forEach(id => {
            if (id != null) allRemoteDeletedIds.add(String(id));
          });
        });

        const allLocalDeletedIds = new Set();
        Object.values(localEnv.days || {}).forEach(d => {
          (d._deletedIds || []).forEach(id => {
            if (id != null) allLocalDeletedIds.add(String(id));
          });
        });

        const allRemoteDeletedRecurringIds = new Set((remoteEnv._deletedRecurringIds || []).map(String));
        const allLocalDeletedRecurringIds = new Set((localEnv._deletedRecurringIds || []).map(String));
        const mergedDeletedRecurringIds = new Set([
          ...(remoteEnv._deletedRecurringIds || []).map(String),
          ...(localEnv._deletedRecurringIds || []).map(String)
        ]);
        mergedEnv._deletedRecurringIds = Array.from(mergedDeletedRecurringIds);

        allDates.forEach(dateStr => {
          const lDay = (localEnv.days && localEnv.days[dateStr]) || {};
          const rDay = (remoteEnv.days && remoteEnv.days[dateStr]) || {};

          // Iniciar reuniones con las de la nube que no hayan sido borradas localmente
          const mMeetings = (rDay.meetings || []).filter(m => m && (m.id == null || !allLocalDeletedIds.has(String(m.id))));
          const meetingKeys = new Set(mMeetings.map(m => `${m.title}_${m.start}_${m.end}`));
          const meetingIdsInDay = new Set(mMeetings.filter(m => m && m.id != null).map(m => String(m.id)));
          (lDay.meetings || []).forEach(m => {
            if (!m) return;
            // Si la reunión fue borrada en la nube, no resucitarla
            if (m.id != null && allRemoteDeletedIds.has(String(m.id))) return;
            if (m.id != null && meetingIdsInDay.has(String(m.id))) return;

            const key = `${m.title}_${m.start}_${m.end}`;
            if (!meetingKeys.has(key)) {
              mMeetings.push(m);
              meetingKeys.add(key);
              if (m.id != null) meetingIdsInDay.add(String(m.id));
            }
          });
          mMeetings.sort((a, b) => a.start - b.start);

          // Iniciar tareas con las de la nube que no hayan sido borradas localmente
          const mTasks = (rDay.tasks || []).filter(t => t && (t.id == null || !allLocalDeletedIds.has(String(t.id))));
          const taskIdsInDay = new Set(mTasks.filter(t => t && t.id != null).map(t => String(t.id)));
          const taskTitles = new Set(mTasks.map(t => (t.title || "").toLowerCase().trim()));
          (lDay.tasks || []).forEach(t => {
            if (!t) return;
            // Si la tarea fue borrada intencionalmente en la nube, no resucitarla
            if (t.id != null && allRemoteDeletedIds.has(String(t.id))) {
              return;
            }
            // Si la tarea ya existe en el estado remoto (en este u otro día),
            // no la añadimos desde local para respetar la ubicación y estado de la nube
            if (t.id != null && allRemoteTaskIds.has(String(t.id))) {
              return;
            }
            const normTitle = (t.title || "").toLowerCase().trim();
            if (!taskTitles.has(normTitle) && (t.id == null || !taskIdsInDay.has(String(t.id)))) {
              mTasks.push(t);
              taskTitles.add(normTitle);
              if (t.id != null) taskIdsInDay.add(String(t.id));
            }
          });

          // Iniciar interrupciones con las de la nube que no hayan sido borradas localmente
          const mInts = (rDay.interruptions || []).filter(i => i && (i.id == null || !allLocalDeletedIds.has(String(i.id))));
          const intIds = new Set(mInts.map(i => String(i.id)));
          (lDay.interruptions || []).forEach(i => {
            if (!i) return;
            if (i.id != null && allRemoteDeletedIds.has(String(i.id))) return;
            if (!intIds.has(String(i.id))) {
              mInts.push(i);
              intIds.add(String(i.id));
            }
          });

          // Combinar los IDs eliminados del día
          const mergedDeletedIds = new Set([
            ...(rDay._deletedIds || []).map(String),
            ...(lDay._deletedIds || []).map(String)
          ]);

          mergedEnv.days[dateStr] = {
            workStart: rDay.workStart !== undefined ? rDay.workStart : (lDay.workStart !== undefined ? lDay.workStart : (envKey === 'personal' ? 18 * 60 : 9 * 60)),
            workEnd: rDay.workEnd !== undefined ? rDay.workEnd : (lDay.workEnd !== undefined ? lDay.workEnd : (envKey === 'personal' ? 23 * 60 : 18 * 60)),
            planningMode: rDay.planningMode !== undefined ? rDay.planningMode : (lDay.planningMode || false),
            meetings: mMeetings,
            tasks: mTasks,
            interruptions: mInts,
            _deletedIds: Array.from(mergedDeletedIds)
          };
        });

        // Merge history array
        const historyMap = new Map();
        (remoteEnv.history || []).forEach(h => { if (h && h.date) historyMap.set(h.date, { ...h }); });
        (localEnv.history || []).forEach(h => {
          if (h && h.date && !historyMap.has(h.date)) {
            historyMap.set(h.date, { ...h });
          }
        });
        mergedEnv.history = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        // Merge recurringMeetings array
        const recMeetingsMap = new Map();
        (remoteEnv.recurringMeetings || []).forEach(r => {
          if (r && r.id && !allLocalDeletedRecurringIds.has(String(r.id))) {
            recMeetingsMap.set(String(r.id), JSON.parse(JSON.stringify(r)));
          }
        });
        (localEnv.recurringMeetings || []).forEach(l => {
          if (l && l.id && !allRemoteDeletedRecurringIds.has(String(l.id))) {
            const key = String(l.id);
            if (!recMeetingsMap.has(key)) {
              recMeetingsMap.set(key, JSON.parse(JSON.stringify(l)));
            } else {
              const existing = recMeetingsMap.get(key);
              const combinedExceptions = { ...(existing.exceptions || {}), ...(l.exceptions || {}) };
              recMeetingsMap.set(key, { ...existing, ...l, exceptions: combinedExceptions });
            }
          }
        });
        mergedEnv.recurringMeetings = Array.from(recMeetingsMap.values());

        // Merge recurringTasks array
        const recTasksMap = new Map();
        (remoteEnv.recurringTasks || []).forEach(r => {
          if (r && r.id && !allLocalDeletedRecurringIds.has(String(r.id))) {
            recTasksMap.set(String(r.id), JSON.parse(JSON.stringify(r)));
          }
        });
        (localEnv.recurringTasks || []).forEach(l => {
          if (l && l.id && !allRemoteDeletedRecurringIds.has(String(l.id))) {
            const key = String(l.id);
            if (!recTasksMap.has(key)) {
              recTasksMap.set(key, JSON.parse(JSON.stringify(l)));
            } else {
              const existing = recTasksMap.get(key);
              const combinedExceptions = { ...(existing.exceptions || {}), ...(l.exceptions || {}) };
              recTasksMap.set(key, { ...existing, ...l, exceptions: combinedExceptions });
            }
          }
        });
        mergedEnv.recurringTasks = Array.from(recTasksMap.values());
      });

      let maxId = 0;
      ['work', 'personal'].forEach(envKey => {
        const env = merged.environments[envKey];
        Object.values(env.days || {}).forEach(day => {
          (day.meetings || []).forEach(m => { if (typeof m.id === 'number' && m.id > maxId) maxId = m.id; });
          (day.tasks || []).forEach(t => { if (typeof t.id === 'number' && t.id > maxId) maxId = t.id; });
          (day.interruptions || []).forEach(i => { if (typeof i.id === 'number' && i.id > maxId) maxId = i.id; });
        });
        (env.recurringMeetings || []).forEach(rm => { if (typeof rm.id === 'number' && rm.id > maxId) maxId = rm.id; });
        (env.recurringTasks || []).forEach(rt => { if (typeof rt.id === 'number' && rt.id > maxId) maxId = rt.id; });
      });
      merged.nextId = Math.max(merged.nextId || 1, local.nextId || 1, remote.nextId || 1, maxId + 1);

      if (snapshotAndPrune) {
        snapshotAndPrune(merged);
      }

      return merged;
    }

    function countItems(st){
      const wrapped = wrapState(st);
      let tasks = 0, meetings = 0;
      let hasSchedule = false;
      ['work', 'personal'].forEach(k => {
        const env = wrapped.environments[k];
        if(env){
          if(env.weeklySchedule) hasSchedule = true;
          if(env.days){
            Object.values(env.days).forEach(day => {
              tasks += (day.tasks || []).length;
              meetings += (day.meetings || []).length;
            });
          }
          meetings += (env.recurringMeetings || []).length;
          tasks += (env.recurringTasks || []).length;
        }
      });
      return { tasks, meetings, total: tasks + meetings, hasSchedule };
    }

    function attachCloudSync(uid){
      setSyncStatus("saving", "⏳ Conectando con la nube…");
      let firstUsableSnapshotSeen = false;
      let slowConnectionTimer = setTimeout(()=>{
        if(!firstUsableSnapshotSeen){
          setSyncStatus("error", "⚠ Tardando en conectar con la nube… tus cambios se guardan en local mientras tanto.");
        }
      }, 8000);

      if(cloudUnsubscribe) cloudUnsubscribe();
      cloudUnsubscribe = cloudDocRef(uid).onSnapshot({includeMetadataChanges: true}, doc => {
        if(doc.metadata.fromCache && !doc.exists && !firstUsableSnapshotSeen){
          return;
        }

        if(!firstUsableSnapshotSeen){
          firstUsableSnapshotSeen = true;
          clearTimeout(slowConnectionTimer);

          if(doc.exists){
            const state = getState();
            const cloudData = doc.data() || {};
            const cloudCounts = countItems(cloudData);
            const localCounts = countItems(state);

            const cloudHasData = cloudCounts.total > 0 || cloudCounts.hasSchedule;
            const localHasData = localCounts.total > 0 || localCounts.hasSchedule;

            if(!cloudHasData && localHasData){
              console.log("La nube está vacía pero el dispositivo tiene datos. Protegiendo datos locales y subiendo a la nube...");
              pushToCloud();
              showToast("Se han protegido y subido tus datos de este dispositivo a la nube.");
            }
            else if(localCounts.total === 0 && cloudCounts.total > 0 && !localCounts.hasSchedule){
              // Local sin tareas ni horario → cargar nube directamente
              backupLocalState();
              applyingRemoteUpdate = true;
              const loadedCloud = wrapState(cloudData);
              loadedCloud.selectedDate = (getState && getState().selectedDate) || defaultState().selectedDate;
              setState(loadedCloud);
              setMeetingEdit(null); setTaskEdit(null);
              applyingRemoteUpdate = false;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
              syncFormInputsFromState();
              renderAll();
              showToast("Datos cargados desde la nube.");
            }
            else if(localCounts.total === 0 && cloudCounts.total > 0 && localCounts.hasSchedule){
              // Local tiene horario pero sin tareas, nube tiene tareas → merge para no perder el horario local
              backupLocalState();
              applyingRemoteUpdate = true;
              setState(mergeStates(state, cloudData));
              setMeetingEdit(null); setTaskEdit(null);
              applyingRemoteUpdate = false;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
              syncFormInputsFromState();
              renderAll();
              pushToCloud();
              showToast("Datos cargados desde la nube.");
            }
            else if(localCounts.total > 0 && cloudCounts.total > 0){
              backupLocalState();
              applyingRemoteUpdate = true;
              setState(mergeStates(state, cloudData));
              setMeetingEdit(null); setTaskEdit(null);
              applyingRemoteUpdate = false;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
              syncFormInputsFromState();
              renderAll();
              pushToCloud();
              showToast("Datos combinados y sincronizados con la nube.");
            } else if(cloudHasData && !localHasData){
              // Nube tiene solo horario (sin tareas), local vacío → cargar nube
              backupLocalState();
              applyingRemoteUpdate = true;
              const loadedCloud = wrapState(cloudData);
              loadedCloud.selectedDate = (getState && getState().selectedDate) || defaultState().selectedDate;
              setState(loadedCloud);
              setMeetingEdit(null); setTaskEdit(null);
              applyingRemoteUpdate = false;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
              syncFormInputsFromState();
              renderAll();
              showToast("Datos cargados desde la nube.");
            } else {
              // Ambos vacíos (sin tareas y sin horario): subir estado local
              pushToCloud();
            }
          } else {
            pushToCloud();
          }
          setSyncStatus("", "☁ Sincronizado");
          return;
        }

        if(doc.metadata.hasPendingWrites) return;
        if(!doc.exists) return;

        const remoteData = doc.data() || {};
        // Si la actualización proviene del propio dispositivo (confirmación de Firestore),
        // no mostramos el mensaje de "otro dispositivo" ni re-aplicamos el estado local.
        if(remoteData._lastUpdatedBy === clientId){
          setSyncStatus("", "☁ Sincronizado");
          return;
        }

        backupLocalState();
        applyingRemoteUpdate = true;
        // Al actualizar desde otro dispositivo, mergeStates aplica los datos y el horario semanal de la nube (el cual prevalece salvo que sea null)
        setState(mergeStates(getState(), remoteData));
        setMeetingEdit(null); setTaskEdit(null);
        applyingRemoteUpdate = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
        syncFormInputsFromState();
        renderAll();
        setSyncStatus("", "☁ Actualizado desde otro dispositivo");
        showToast("Se han actualizado los datos desde otro dispositivo.");
      }, err => {
        clearTimeout(slowConnectionTimer);
        console.error("Error en la escucha de Firestore", err);
        setSyncStatus("error", "⚠ Se perdió la conexión con la nube");
      });
    }

    function detachCloudSync(){
      if(cloudUnsubscribe){ cloudUnsubscribe(); cloudUnsubscribe = null; }
    }

    function renderAuthArea(){
      const el = document.getElementById("authArea");
      const modeLabel = document.getElementById("appModeLabel");
      if(!el) return;
      if(currentUser){
        if(modeLabel) modeLabel.textContent = "☁️ nube · sincronizado";
        const photo = currentUser.photoURL ? `<img src="${escapeAttr(currentUser.photoURL)}" alt="">` : "";
        el.innerHTML = `
          <span class="auth-user">${photo}${escapeHtml(currentUser.displayName || currentUser.email || "")}</span>
          <span class="sync-status" id="syncStatus">☁ Conectado</span>
          <button class="btn secondary" id="signOutBtn">Cerrar sesión</button>
        `;
        document.getElementById("signOutBtn").addEventListener("click", ()=>{
          detachCloudSync();
          fbAuth.signOut();
        });
      } else {
        if(modeLabel) modeLabel.textContent = "💾 local · persistente";
        el.innerHTML = `<button class="btn secondary" id="signInBtn">☁ Iniciar sesión con Google</button>`;
        document.getElementById("signInBtn").addEventListener("click", signInWithGoogle);
      }
    }

    function signInWithGoogle(){
      if(!fbAuth){ showToast("La conexión con Firebase no está disponible."); return; }
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      fbAuth.signInWithPopup(provider).catch(err => {
        console.warn("signInWithPopup falló o fue bloqueado, intentando fallback con redirect...", err);
        if(err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-allowed'){
          fbAuth.signInWithRedirect(provider).catch(rErr => {
            console.error("Error en signInWithRedirect", rErr);
            showToast("No se pudo iniciar sesión: " + (rErr.message || rErr.code || "error desconocido"));
          });
        } else if(err.code !== 'auth/popup-closed-by-user'){
          console.error("Error al iniciar sesión", err);
          showToast("No se pudo iniciar sesión: " + (err.message || err.code || "error desconocido"));
        }
      });
    }

    function initFirebase(){
      if(typeof firebase === "undefined"){
        console.error("El SDK de Firebase no se cargó.");
        return;
      }
      try{
        firebase.initializeApp(firebaseConfig);
        fbAuth = firebase.auth();
        fbDb = firebase.firestore();

        fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
          console.warn("No se pudo fijar la persistencia local de autenticación", err);
        });

        fbDb.settings({ experimentalAutoDetectLongPolling: true });

        fbAuth.onAuthStateChanged(user => {
          currentUser = user;
          renderAuthArea();
          if(user){
            attachCloudSync(user.uid);
          } else {
            detachCloudSync();
          }
        });

        fbAuth.getRedirectResult().then(result => {
          if(result && result.user){
            showToast("Sesión iniciada con Google.");
          }
        }).catch(err => {
          if(err && err.code && err.code !== 'auth/popup-closed-by-user'){
            console.error("Error al completar el inicio de sesión por redirect", err);
            showToast("No se pudo completar el inicio de sesión: " + (err.message || err.code));
          }
        });
      }catch(err){
        console.error("No se pudo inicializar Firebase", err);
      }
    }

    return {
      getClientId, pushToCloud, pushToCloudDebounced, flushPendingCloudPush,
      backupLocalState, restoreLocalBackup, mergeStates,
      attachCloudSync, detachCloudSync, renderAuthArea, signInWithGoogle, initFirebase
    };
}

export default TodayTasksCloud;
