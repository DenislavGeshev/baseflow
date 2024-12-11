(() => {
  let currentUser = null;
  let notificationParent = null;

  /**
   * Utility: Find notification parent
   */
  const findNotificationParent = () => {
    const el = document.querySelector("[bflow-sb-notification-parent='true']");
    return el || document.body;
  };

  /**
   * Utility: Show notifications
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
      if (notif.parentNode) notif.parentNode.removeChild(notif);
    }, 5000);
  };

  /**
   * Utility: Set loading state
   */
  const setLoading = (element, loading) => {
    if (!element) return;
    const loadingAttr = element.getAttribute("bflow-sb-loading");
    if (loadingAttr === "true") {
      element.disabled = loading;
      element.style.opacity = loading ? "0.5" : "1";
    }
  };

  /**
   * Utility: Handle Refresh on Success
   */
  const handleRefreshOnSuccess = (success) => {
    if (success) {
      const refreshElements = document.querySelectorAll("[bflow-sb-refresh-on-success='true']");
      if (refreshElements.length > 0) {
        window.location.reload();
      }
    }
  };

  /**
   * Fetch current user
   */
  const fetchCurrentUser = async () => {
    if (typeof supabase === 'undefined') {
      console.error("Supabase not defined. Initialize before this script.");
      return null;
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error("Error fetching user:", error);
    currentUser = user;
    return user;
  };

  /**
   * Page-Level Access: Redirect if user doesn't match required access
   */
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
    } else if (requiredAccess === "premium") {
      // Custom logic: assume user.user_metadata.premium
      hasAccess = currentUser && currentUser.user_metadata && currentUser.user_metadata.premium;
    } else {
      // Role-based page access:
      hasAccess = currentUser && currentUser.role === requiredAccess;
    }

    if (!hasAccess && redirectUrl) {
      window.location.href = redirectUrl;
    }
  };

  /**
   * Visibility based on user state/role
   */
  const handleVisibility = async () => {
    const elements = document.querySelectorAll("[bflow-sb-visibility]");
    await fetchCurrentUser();
    elements.forEach(el => {
      const visibility = el.getAttribute("bflow-sb-visibility");
      const hideIf = el.getAttribute("bflow-sb-visibility-hide-if") === "true";
      let shouldHide = false;

      if (visibility === "authenticated") shouldHide = !currentUser;
      if (visibility === "unauthenticated") shouldHide = !!currentUser;
      if (visibility && visibility !== "authenticated" && visibility !== "unauthenticated") {
        // Role-based visibility
        shouldHide = !(currentUser && currentUser.role === visibility);
      }

      const finalHide = hideIf ? shouldHide : !shouldHide;
      el.style.display = finalHide ? "none" : "";
    });
  };

  /**
   * Role-based element hiding
   */
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

  /**
   * Dynamic Content Rendering
   */
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

  /**
   * Event Tracking
   */
  const handleEventTracking = () => {
    document.addEventListener("click", (event) => {
      const tracker = event.target.closest("[bflow-sb-track]");
      if (tracker) {
        const eventName = tracker.getAttribute("bflow-sb-track");
        console.log(`Event Tracked: ${eventName}`);
        // You could send this event to an analytics service if desired
      }
    });
  };

  /**
   * Error Handling and Feedback
   * If you want to show/hide specific error elements:
   */
  const handleErrors = () => {
    const elements = document.querySelectorAll("[bflow-sb-error]");
    elements.forEach(el => {
      const showError = el.getAttribute("bflow-sb-error") === "show";
      const errorMsg = el.getAttribute("bflow-sb-error-message") || "An error occurred.";
      if (showError) {
        el.innerText = errorMsg;
        el.style.display = "block";
      } else {
        el.style.display = "none";
      }
    });
  };

  /**
   * Confirmation Modals
   */
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
          trigger.setAttribute("bflow-sb-confirm", confirmMsg);
          trigger.setAttribute("bflow-sb-confirm-target", target);
        };

        if (confirmButton) confirmButton.onclick = originalClick;
        if (cancelButton) cancelButton.onclick = () => {
          modal.style.display = "none";
        };
      }
    });
  };

  /**
   * Extract payload from form inputs
   */
  const getFormPayload = (form) => {
    const payload = {};
    const inputs = form.querySelectorAll("[bflow-sb-input]");
    inputs.forEach((input) => {
      const fieldType = input.getAttribute("bflow-sb-input");
      const fieldName = input.getAttribute("bflow-sb-input-field") || fieldType;
      payload[fieldName] = input.value;
    });
    return payload;
  };

  /**
   * Auth Operations
   */
  const handleAuthOperation = async (operation, payload, redirectUrl) => {
    let success = false;
    try {
      let response;
      if (operation === "signup") {
        response = await supabase.auth.signUp({ email: payload.email, password: payload.password });
        if (response.error) throw response.error;
        showNotification("Registration successful! Check your email.", "success");
        success = true;
      } else if (operation === "login") {
        response = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
        if (response.error) throw response.error;
        showNotification("Login successful!", "success");
        success = true;
      } else if (operation === "logout") {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        showNotification("Logged out successfully!", "success");
        success = true;
      } else if (operation === "reset-password") {
        response = await supabase.auth.resetPasswordForEmail(payload.email);
        if (response.error) throw response.error;
        showNotification("Password reset email sent!", "success");
        success = true;
      } else if (operation === "check") {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        showNotification(user ? `Logged in as: ${user.email}` : "Not logged in.", "info");
      } else if (operation.startsWith("otp-")) {
        // handle otp-email, otp-phone
        const { error } = await supabase.auth.signInWithOtp(payload);
        if (error) throw error;
        showNotification("OTP sent!", "success");
        success = true;
      } else if (operation === "verify-otp") {
        const { error } = await supabase.auth.verifyOtp(payload);
        if (error) throw error;
        showNotification("OTP verified!", "success");
        success = true;
      } else if (operation.startsWith("oauth-")) {
        const provider = operation.split("-")[1];
        const { error } = await supabase.auth.signInWithOAuth({ provider });
        if (error) throw error;
        showNotification(`Redirecting to ${provider}...`, "info");
      } else {
        console.warn(`Unknown auth operation: ${operation}`);
      }

      await fetchCurrentUser();
      handleRefreshOnSuccess(success);
      if (success && redirectUrl) window.location.href = redirectUrl;
    } catch (error) {
      console.error("Auth Error:", error);
      showNotification(`Error: ${error.message}`, "error");
    }
  };

  /**
   * CRUD Operations
   */
  const handleCrudOperation = async (operation, table, id, payload) => {
    let success = false;
    try {
      let response;
      if (operation === "create") {
        response = await supabase.from(table).insert(payload);
      } else if (operation === "read") {
        response = await supabase.from(table).select();
      } else if (operation === "update") {
        if (!id) throw new Error("No ID provided for update.");
        response = await supabase.from(table).update(payload).eq("id", id);
      } else if (operation === "delete") {
        if (!id) throw new Error("No ID provided for delete.");
        response = await supabase.from(table).delete().eq("id", id);
      } else {
        throw new Error(`Unknown CRUD operation: ${operation}`);
      }

      if (response.error) throw response.error;
      showNotification(`CRUD ${operation} successful`, "success");
      success = true;
      handleDynamicContent(); // Refresh dynamic content after CRUD
      handleRefreshOnSuccess(success);
    } catch (error) {
      console.error("CRUD Error:", error);
      showNotification(`Error: ${error.message}`, "error");
    }
  };

  /**
   * Handle Form Submissions (Auth or CRUD)
   */
  const handleFormSubmissions = () => {
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[bflow-sb-form]");
      if (!form) return;

      event.preventDefault();
      setLoading(form, true);

      const formType = form.getAttribute("bflow-sb-form");
      const payload = getFormPayload(form);

      if (formType === "auth") {
        const operation = form.getAttribute("bflow-sb-auth");
        const redirectUrl = form.getAttribute("bflow-sb-auth-redirect");
        await handleAuthOperation(operation, payload, redirectUrl);
      } else if (formType === "crud") {
        const operation = form.getAttribute("bflow-sb-crud");
        const table = form.getAttribute("bflow-sb-crud-table");
        const id = form.getAttribute("bflow-sb-crud-id");
        // Also merge static payload if provided
        const staticPayloadAttr = form.getAttribute("bflow-sb-crud-payload");
        if (staticPayloadAttr) {
          try {
            const staticPayload = JSON.parse(staticPayloadAttr);
            Object.assign(payload, staticPayload);
          } catch (err) {
            console.error("Invalid JSON in bflow-sb-crud-payload:", err);
          }
        }
        await handleCrudOperation(operation, table, id, payload);
      }

      setLoading(form, false);
    });
  };

  /**
   * Handle Non-Form Auth & CRUD Actions (e.g. buttons)
   */
  const handleNonFormActions = () => {
    document.addEventListener("click", async (event) => {
      const el = event.target.closest("[bflow-sb-auth],[bflow-sb-crud]");
      if (!el) return;
      // Skip if it's part of a form, since forms handled by submit
      if (el.hasAttribute("bflow-sb-form")) return;
      // Confirmation handled separately, skip if needed
      if (el.hasAttribute("bflow-sb-confirm")) return;

      setLoading(el, true);

      if (el.hasAttribute("bflow-sb-auth")) {
        const operation = el.getAttribute("bflow-sb-auth");
        const redirectUrl = el.getAttribute("bflow-sb-auth-redirect");
        const email = el.getAttribute("bflow-sb-auth-email");
        const password = el.getAttribute("bflow-sb-auth-password");
        const phone = el.getAttribute("bflow-sb-auth-phone");
        const token = el.getAttribute("bflow-sb-auth-token");
        const type = el.getAttribute("bflow-sb-auth-type");
        const payload = { email, password, phone, token, type };
        await handleAuthOperation(operation, payload, redirectUrl);
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
        await handleCrudOperation(operation, table, id, payload);
      }

      setLoading(el, false);
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (typeof supabase === 'undefined') {
      console.error("Supabase is not defined. Ensure it's initialized before loading this script.");
      return;
    }

    await fetchCurrentUser();
    await checkPageAccess();
    await handleVisibility();
    await handleRoles();
    await handleDynamicContent();
    handleEventTracking();
    handleErrors();
    handleConfirmation();
    handleFormSubmissions();
    handleNonFormActions();
  });
})();
