(() => {
  let currentUser = null;
  let notificationParent = null;

  /**
   * Locate the notification parent container
   * We look for an element with the attribute: bflow-sb-notification-parent="true"
   * If not found, use document.body
   */
  const findNotificationParent = () => {
    const el = document.querySelector("[bflow-sb-notification-parent='true']");
    return el || document.body;
  };

  /**
   * Show notification messages inside the notification parent element
   * type can be: "info", "success", "error"
   */
  const showNotification = (message, type = "info") => {
    if (!notificationParent) notificationParent = findNotificationParent();

    const notif = document.createElement("div");
    notif.textContent = message;
    notif.className = `bflow-notification ${type}`;
    Object.assign(notif.style, {
      padding: "10px",
      marginTop: "10px",
      borderRadius: "5px",
      fontFamily: "sans-serif",
      transition: "all 0.3s ease"
    });
    if (type === "success") {
      notif.style.backgroundColor = "#dff0d8";
      notif.style.color = "#3c763d";
    } else if (type === "error") {
      notif.style.backgroundColor = "#f2dede";
      notif.style.color = "#a94442";
    } else {
      notif.style.backgroundColor = "#d9edf7";
      notif.style.color = "#31708f";
    }

    notificationParent.appendChild(notif);

    setTimeout(() => {
      if (notif.parentNode) {
        notif.parentNode.removeChild(notif);
      }
    }, 5000);
  };

  const fetchCurrentUser = async () => {
    if (typeof supabase === 'undefined') {
      console.error("Supabase is not defined. Make sure to initialize it before loading this script.");
      return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    return user;
  };

  const checkPageAccess = async () => {
    const body = document.querySelector("body");
    if (!body) return;
    const requiredAccess = body.getAttribute("bflow-sb-page-access");
    const redirectUrl = body.getAttribute("bflow-sb-page-redirect");
    if (!requiredAccess) return;

    await fetchCurrentUser();
    let hasAccess = false;

    if (requiredAccess === "authenticated") {
      hasAccess = !!currentUser;
    } else if (requiredAccess === "unauthenticated") {
      hasAccess = !currentUser;
    }

    if (!hasAccess && redirectUrl) {
      window.location.href = redirectUrl;
    }
  };

  const handleVisibility = async () => {
    const elements = document.querySelectorAll("[bflow-sb-visibility]");
    await fetchCurrentUser();
    elements.forEach(el => {
      const visibility = el.getAttribute("bflow-sb-visibility");
      const hideIf = el.getAttribute("bflow-sb-visibility-hide-if") === "true";
      let shouldHide = false;
      if (visibility === "authenticated") shouldHide = !currentUser;
      if (visibility === "unauthenticated") shouldHide = !!currentUser;

      const finalHide = hideIf ? shouldHide : !shouldHide;
      el.style.display = finalHide ? "none" : "";
    });
  };

  const handleRoles = async () => {
    const elements = document.querySelectorAll("[bflow-sb-role]");
    await fetchCurrentUser();
    elements.forEach(el => {
      const requiredRole = el.getAttribute("bflow-sb-role");
      const hideIf = el.getAttribute("bflow-sb-role-hide-if") === "true";
      const userHasRole = currentUser && currentUser.role === requiredRole;
      let shouldHide = false;
      if (hideIf && userHasRole) shouldHide = true;
      if (!hideIf && !userHasRole) shouldHide = true;
      el.style.display = shouldHide ? "none" : "";
    });
  };

  const handleDynamicContent = async () => {
    const elements = document.querySelectorAll("[bflow-sb-content='dynamic']");
    await fetchCurrentUser();
    for (const el of elements) {
      const table = el.getAttribute("bflow-sb-content-table");
      const field = el.getAttribute("bflow-sb-content-field");
      if (!table || !field) continue;
      try {
        const { data, error } = await supabase.from(table).select(field);
        if (error) throw error;
        if (data && data.length > 0) {
          el.innerText = data.map(d => d[field]).join(", ");
        }
      } catch (err) {
        console.error("Error fetching dynamic content:", err);
        showNotification("Error loading content", "error");
      }
    }
  };

  const handleConfirmation = () => {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[bflow-sb-confirm]");
      if (trigger) {
        event.preventDefault();
        const modalId = trigger.getAttribute("bflow-sb-confirm-target");
        const modal = document.getElementById(modalId);
        if (!modal) {
          console.error("Modal not found:", modalId);
          return;
        }
        modal.style.display = "block";

        const confirmButton = modal.querySelector("[bflow-sb-confirm-button='true']");
        const cancelButton = modal.querySelector("[bflow-sb-cancel-button='true']");

        const originalClick = () => {
          modal.style.display = "none";
          const confirmMsg = trigger.getAttribute("bflow-sb-confirm");
          const target = trigger.getAttribute("bflow-sb-confirm-target");
          trigger.removeAttribute("bflow-sb-confirm");
          trigger.removeAttribute("bflow-sb-confirm-target");
          trigger.click();
          // Re-add attributes
          trigger.setAttribute("bflow-sb-confirm", confirmMsg);
          trigger.setAttribute("bflow-sb-confirm-target", target);
        };

        if (confirmButton) confirmButton.onclick = originalClick;
        if (cancelButton) cancelButton.onclick = () => { modal.style.display = "none"; };
      }
    });
  };

  const setLoading = (element, loading) => {
    if (!element) return;
    const loadingAttr = element.getAttribute("bflow-sb-loading");
    if (loadingAttr === "true") {
      element.disabled = loading;
      element.style.opacity = loading ? "0.5" : "1";
    }
  };

  const handleRefreshOnSuccess = (success) => {
    if (success) {
      const refreshElements = document.querySelectorAll("[bflow-sb-refresh-on-success='true']");
      if (refreshElements.length > 0) {
        window.location.reload();
      }
    }
  };

  const handleFormSubmission = () => {
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[bflow-sb-form]");
      if (!form) return;
      event.preventDefault();
      setLoading(form, true);

      const formType = form.getAttribute("bflow-sb-form");
      let operation, table, id, payload = {};

      const inputs = form.querySelectorAll("[bflow-sb-input]");
      inputs.forEach((input) => {
        const fieldType = input.getAttribute("bflow-sb-input");
        const fieldName = input.getAttribute("bflow-sb-input-field") || fieldType;
        payload[fieldName] = input.value;
      });

      let success = false;

      try {
        if (formType === "auth") {
          operation = form.getAttribute("bflow-sb-auth");
          const redirectUrl = form.getAttribute("bflow-sb-auth-redirect");
          let response;
          if (operation === "login") {
            response = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
          } else if (operation === "signup") {
            response = await supabase.auth.signUp({ email: payload.email, password: payload.password });
          } else if (operation === "logout") {
            response = await supabase.auth.signOut();
          } else if (operation === "check") {
            response = await supabase.auth.getUser();
          } else if (operation === "reset-password") {
            response = await supabase.auth.resetPasswordForEmail(payload.email);
          }

          if (response && !response.error) {
            success = true;
            showNotification(`Auth ${operation} successful`, "success");
            if (redirectUrl) window.location.href = redirectUrl;
          } else if (response && response.error) {
            showNotification(`Auth Error: ${response.error.message}`, "error");
          }

          await fetchCurrentUser();
        } else if (formType === "crud") {
          operation = form.getAttribute("bflow-sb-crud");
          table = form.getAttribute("bflow-sb-crud-table");
          id = form.getAttribute("bflow-sb-crud-id");
          const staticPayloadAttr = form.getAttribute("bflow-sb-crud-payload");
          if (staticPayloadAttr) {
            try {
              const staticPayload = JSON.parse(staticPayloadAttr);
              payload = { ...payload, ...staticPayload };
            } catch (err) {
              console.error("Invalid JSON in bflow-sb-crud-payload:", err);
            }
          }

          let response;
          if (operation === "create") {
            response = await supabase.from(table).insert(payload);
          } else if (operation === "read") {
            response = await supabase.from(table).select();
          } else if (operation === "update") {
            if (!id) {
              showNotification("No ID provided for update.", "error");
            } else {
              response = await supabase.from(table).update(payload).eq("id", id);
            }
          } else if (operation === "delete") {
            if (!id) {
              showNotification("No ID provided for delete.", "error");
            } else {
              response = await supabase.from(table).delete().eq("id", id);
            }
          }

          if (response && !response.error) {
            success = true;
            showNotification(`CRUD ${operation} successful`, "success");
          } else if (response && response.error) {
            showNotification(`Error: ${response.error.message}`, "error");
          }
        }

        handleRefreshOnSuccess(success);
      } catch (error) {
        console.error("Error:", error);
        showNotification(`Error: ${error.message}`, "error");
      } finally {
        setLoading(form, false);
        // Update dynamic content if CRUD changed something
        handleDynamicContent();
      }
    });
  };

  const handleNonFormActions = () => {
    document.addEventListener("click", async (event) => {
      const el = event.target.closest("[bflow-sb-crud],[bflow-sb-auth],[bflow-sb-confirm]");
      if (!el || el.hasAttribute("bflow-sb-form")) return;
      if (el.hasAttribute("bflow-sb-confirm")) return; // handled by confirmation

      setLoading(el, true);
      let success = false;

      try {
        if (el.hasAttribute("bflow-sb-auth")) {
          const operation = el.getAttribute("bflow-sb-auth");
          const email = el.getAttribute("bflow-sb-auth-email");
          const password = el.getAttribute("bflow-sb-auth-password");
          const redirectUrl = el.getAttribute("bflow-sb-auth-redirect");

          let response;
          if (operation === "login") {
            response = await supabase.auth.signInWithPassword({ email, password });
          } else if (operation === "signup") {
            response = await supabase.auth.signUp({ email, password });
          } else if (operation === "logout") {
            response = await supabase.auth.signOut();
          } else if (operation === "check") {
            response = await supabase.auth.getUser();
          } else if (operation === "reset-password") {
            response = await supabase.auth.resetPasswordForEmail(email);
          }

          if (response && !response.error) {
            showNotification(`Auth ${operation} successful`, "success");
            success = true;
            if (redirectUrl) window.location.href = redirectUrl;
          } else if (response && response.error) {
            showNotification(`Error: ${response.error.message}`, "error");
          }

          await fetchCurrentUser();
        }

        if (el.hasAttribute("bflow-sb-crud")) {
          const operation = el.getAttribute("bflow-sb-crud");
          const table = el.getAttribute("bflow-sb-crud-table");
          const id = el.getAttribute("bflow-sb-crud-id");
          const payloadAttr = el.getAttribute("bflow-sb-crud-payload");
          let payload = {};
          if (payloadAttr) {
            try {
              payload = JSON.parse(payloadAttr);
            } catch (err) {
              console.error("Invalid JSON in bflow-sb-crud-payload:", err);
            }
          }

          let response;
          if (operation === "create") {
            response = await supabase.from(table).insert(payload);
          } else if (operation === "read") {
            response = await supabase.from(table).select();
          } else if (operation === "update") {
            if (!id) showNotification("No ID provided for update.", "error");
            else response = await supabase.from(table).update(payload).eq("id", id);
          } else if (operation === "delete") {
            if (!id) showNotification("No ID provided for delete.", "error");
            else response = await supabase.from(table).delete().eq("id", id);
          }

          if (response && !response.error) {
            showNotification(`CRUD ${operation} successful`, "success");
            success = true;
          } else if (response && response.error) {
            showNotification(`Error: ${response.error.message}`, "error");
          }

          handleDynamicContent();
        }

        handleRefreshOnSuccess(success);
      } catch (error) {
        console.error("Error:", error);
        showNotification(`Error: ${error.message}`, "error");
      } finally {
        setLoading(el, false);
      }
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (typeof supabase === 'undefined') {
      console.error("Supabase is not defined. Make sure to initialize it before loading this script.");
      return;
    }
    await fetchCurrentUser();
    await checkPageAccess();
    await handleVisibility();
    await handleRoles();
    await handleDynamicContent();

    handleConfirmation();
    handleFormSubmission();
    handleNonFormActions();
  });
})();
