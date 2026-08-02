(function(){
  "use strict";

  const { escapeHtml, escapeAttr, showToast } = window.TodayTasksUi;
  const { defaultState } = window.TodayTasksState;

  window.TodayTasksCloud = function(ctx){
    const {
      getState, setState, setMeetingEdit, setTaskEdit, saveState,
      STORAGE_KEY, syncFormInputsFromState, renderAll
    } = ctx;

    const firebaseConfig = window.TodayTasksConfig.firebase;
    let fbAuth = null, fbDb = null, currentUser = null, cloudUnsubscribe = null;
    let applyingRemoteUpdate = false;

    function cloudDocRef(uid){
      return fbDb.collection("tableroDia").doc(uid);
    }

    function setSyncStatus(kind, text){
      const el = document.getElementById("syncStatus");
      if(!el) return;
      el.className = "sync-status" + (kind ? " " + kind : "");
      el.textContent = text;
    }

    function pushToCloud(){
      if(!currentUser || !fbDb || applyingRemoteUpdate) return;
      setSyncStatus("saving", "⏳ Guardando en la nube…");
      cloudDocRef(currentUser.uid).set(getState())
        .then(()=> setSyncStatus("", "☁ Sincronizado"))
        .catch(err => {
          console.error("Error guardando en Firestore", err);
          setSyncStatus("error", "⚠ Error al sincronizar");
        });
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
        setState(Object.assign(defaultState(), backupState));
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

    function mergeStates(local, remote){
      const merged = Object.assign(defaultState(), remote);
      
      const meetingKeys = new Set((remote.meetings || []).map(m => `${m.title}_${m.start}_${m.end}`));
      (local.meetings || []).forEach(m => {
        const key = `${m.title}_${m.start}_${m.end}`;
        if(!meetingKeys.has(key)){
          merged.meetings.push(m);
          meetingKeys.add(key);
        }
      });
      merged.meetings.sort((a,b) => a.start - b.start);

      const taskTitles = new Set((remote.tasks || []).map(t => (t.title || "").toLowerCase().trim()));
      (local.tasks || []).forEach(t => {
        const normTitle = (t.title || "").toLowerCase().trim();
        if(!taskTitles.has(normTitle)){
          merged.tasks.push(t);
          taskTitles.add(normTitle);
        }
      });

      const intIds = new Set((remote.interruptions || []).map(i => i.id));
      (local.interruptions || []).forEach(i => {
        if(!intIds.has(i.id)){
          merged.interruptions.push(i);
          intIds.add(i.id);
        }
      });

      let maxId = 0;
      merged.meetings.forEach(m => { if(m.id > maxId) maxId = m.id; });
      merged.tasks.forEach(t => { if(t.id > maxId) maxId = t.id; });
      (merged.interruptions || []).forEach(i => { if(i.id > maxId) maxId = i.id; });
      merged.nextId = Math.max(merged.nextId || 1, maxId + 1);

      return merged;
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
            const cloudTasks = cloudData.tasks || [];
            const cloudMeetings = cloudData.meetings || [];
            const localTasks = state.tasks || [];
            const localMeetings = state.meetings || [];

            const cloudCount = cloudTasks.length + cloudMeetings.length;
            const localCount = localTasks.length + localMeetings.length;

            if(cloudCount === 0 && localCount > 0){
              console.log("La nube está vacía pero el dispositivo tiene datos. Protegiendo datos locales y subiendo a la nube...");
              pushToCloud();
              showToast("Se han protegido y subido tus tareas de este dispositivo a la nube.");
            }
            else if(localCount === 0 && cloudCount > 0){
              backupLocalState();
              applyingRemoteUpdate = true;
              setState(Object.assign(defaultState(), cloudData));
              setMeetingEdit(null); setTaskEdit(null);
              applyingRemoteUpdate = false;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
              syncFormInputsFromState();
              renderAll();
              showToast("Datos cargados desde la nube.");
            }
            else if(localCount > 0 && cloudCount > 0){
              const msg = 
                `Se detectaron datos en la nube y en este dispositivo:\n\n` +
                `• Nube: ${cloudTasks.length} tarea(s), ${cloudMeetings.length} reunión(es)\n` +
                `• Este dispositivo: ${localTasks.length} tarea(s), ${localMeetings.length} reunión(es)\n\n` +
                `Aceptar = COMBINAR ambos (Recomendado, no pierde nada)\n` +
                `Cancelar = Cargar solo de la nube`;

              backupLocalState();
              const doMerge = window.confirm(msg);
              if(doMerge){
                applyingRemoteUpdate = true;
                setState(mergeStates(state, cloudData));
                setMeetingEdit(null); setTaskEdit(null);
                applyingRemoteUpdate = false;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
                syncFormInputsFromState();
                renderAll();
                pushToCloud();
                showToast("Datos combinados correctamente.");
              } else {
                applyingRemoteUpdate = true;
                setState(Object.assign(defaultState(), cloudData));
                setMeetingEdit(null); setTaskEdit(null);
                applyingRemoteUpdate = false;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
                syncFormInputsFromState();
                renderAll();
                showToast("Datos cargados desde la nube.");
              }
            } else {
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
        backupLocalState();
        applyingRemoteUpdate = true;
        setState(Object.assign(defaultState(), doc.data()));
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
        if(modeLabel) modeLabel.textContent = "nube · sincronizado";
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
        if(modeLabel) modeLabel.textContent = "local · persistente";
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
      pushToCloud, backupLocalState, restoreLocalBackup, mergeStates,
      attachCloudSync, detachCloudSync, renderAuthArea, signInWithGoogle, initFirebase
    };
  };
})();
