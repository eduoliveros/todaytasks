(function () {
  function escapeHtml(str){
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
  function escapeAttr(str){
    return String(str==null?"":str)
      .replace(/&/g,"&amp;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;");
  }

  let toastTimer = null;
  function showToast(message){
    const el = document.getElementById("toast");
    if(!el) return;
    el.textContent = message;
    el.classList.add("visible");
    if(toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.classList.remove("visible"); }, 4000);
  }


  window.TodayTasksUi = { escapeHtml, escapeAttr, showToast };
})();

