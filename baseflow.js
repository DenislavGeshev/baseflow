(() => {
  let supabase;
  let currentUser = null;

  // Allow configuration from outside
  window.initializeSupabase = ({ supabaseUrl, supabaseKey }) => {
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase URL and Key must be provided.");
      return;
    }
    const { createClient } = window;
    supabase = createClient(supabaseUrl, supabaseKey);
  };

  /**
   * Helper Functions
   */

  // Show feedback (error/success) message
  const showFeedback = (message, type = "success") => {
    const existing = document.querySelector(".bflow-feedback");
    if (existing) existing.remove();

    const feedback = document.createElement("div");
    feedback.innerText = message;
    feedback.className = `bflow-feedback ${type}`;
    Object.assign(feedback.style, {
      position: "fixed",
      bottom: "10px",
      right: "10px",
      background: type === "success" ? "green" : "red",
      color: "white",
      padding: "10px",
      borderRadius: "5px",
      zIndex: 9999,
      fontFamily: "sans-serif"
    });
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 3000);
  };

  // Get current user from Supabase
  const fetchCurrentUser = async () => {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    return user;
  };

  // Check page access and redirect if needed
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
    } else {
      // Could be a role or premium
      if (currentUser && currentUser.role === requiredAccess) {
        hasAccess = true;
      } else if (requiredAccess === "premium") {
        // Custom logic if you have a premium flag in user metadata
        hasAccess = currentUser && currentUser.user_metadata && currentUser.user_metadata.premium;
      }
    }

    if (!hasAccess && redirectUrl) {
      window.location.href = redirectUrl;
    }
  };

  // Handle Visibility (authenticated/unauthenticated/role)
  const handleVisibility = async () => {
    const elements = document.querySelectorAll("[bflow-sb-visibility]");
    await fetchCurrentUser();

    elements.forEach(el => {
      const visibility = el.getAttribute("bflow-sb-visibility");
      const hideIf = el.getAttribute("bflow-sb-visibility-hide-if") === "true";
      let shouldHide = false;

      if (visibility === "authenticated") {
        shouldHide = !currentUser;
      } else if (visibility === "unauthenticated") {
        shouldHide = !!currentUser;
      } else {
        // role-based visibility
        shouldHide = !(currentUser && currentUser.role === visibility);
      }

      const finalHide = hideIf ? shouldHide : !shouldHide;
      el.style.display = finalHide ? "none" : "";
    });
  };

  // Handle Roles on elements
  const handleRoles = async () => {
    const elements = document.querySelectorAll("[bflow-sb-role]");
    await fetchCurrentUser();

    elements.forEach(el => {
      const roleRequired = el.getAttribute("bflow-sb-role");
      const hideIf = el.getAttribute("bflow-sb-role-hide-if") === "true";

      const userHasRole = currentUser && currentUser.role === roleRequired;
      let shouldHide = false;
      if (hideIf && userHasRole) shouldHide = true;
      if (!hideIf && !userHasRole) shouldHide = true;

      el.style.display = shouldHide ? "none" : "";
    });
  };

  // Handle Error display
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

  // Handle Dynamic Content Rendering
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
        showFeedback("Error loading content", "error");
      }
    }
  };

  // Handle Event Tracking
  const handleEventTracking = () => {
    document.addEventListener("click", (event) => {
      const tracker = event.target.closest("[bflow-sb-track]");
      if (tracker) {
        const eventName = tracker.getAttribute("bflow-sb-track");
        console.log(`Event Tracked: ${eventName}`);
        // You could send this event to your analytics service
      }
    });
  };

  // Handle Confirmation Modals
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

        // Show the modal
        modal.style.display = "block";

        const confirmButton = modal.querySelector("[bflow-sb-confirm-button='true']");
        const cancelButton = modal.querySelector("[bflow-sb-cancel-button='true']");

        const originalClick = () => {
          modal.style.display = "none";
          const confirmMsg = trigger.getAttribute("bflow-sb-confirm");
          const target = trigger.getAttribute("bflow-sb-confirm-target");
          trigger.removeAttribute("bflow-sb-confirm");
          trigger.removeAttribute("bflow-sb-confirm-target");
          trigger.click(); // Trigger original action
          // Re-add attributes (in case needed again)
          trigger.setAttribute("bflow-sb-confirm", confirmMsg);
          trigger.setAttribute("bflow-sb-confirm-target", target);
        };

        if (confirmButton) {
          confirmButton.onclick = originalClick;
        }

        if (cancelButton) {
          cancelButton.onclick = () => {
            modal.style.display = "none";
          };
        }
      }
    });
  };

  // Handle Loading and Refresh after operations
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
        // Refresh the page
        window.location.reload();
      }
    }
  };

  // Handle Authentication & CRUD via forms
  const handleFormSubmission = () => {
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[bflow-sb-form]");
      if (!form) return;

      event.preventDefault();
      setLoading(form, true);

      const formType = form.getAttribute("bflow-sb-form"); // auth or crud
      let operation;
      let table, id, payload = {};

      // Collect inputs
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
            response = await supabase.auth.signInWithPassword({
              email: payload.email,
              password: payload.password,
            });
          } else if (operation === "signup") {
            response = await supabase.auth.signUp({
              email: payload.email,
              password: payload.password,
              ...(payload.name ? { data: { name: payload.name } } : {})
            });
          } else if (operation === "logout") {
            response = await supabase.auth.signOut();
          } else if (operation === "check") {
            response = await supabase.auth.getUser();
          } else if (operation === "reset-password") {
            response = await supabase.auth.resetPasswordForEmail(payload.email);
          }

          if (!response?.error) {
            success = true;
            showFeedback(`Auth ${operation} successful`, "success");
            if (redirectUrl) window.location.href = redirectUrl;
          } else {
            showFeedback(`Error: ${response.error.message}`, "error");
          }

          // Update currentUser
          await fetchCurrentUser();

        } else if (formType === "crud") {
          operation = form.getAttribute("bflow-sb-crud");
          table = form.getAttribute("bflow-sb-crud-table");
          id = form.getAttribute("bflow-sb-crud-id");
          // If a static payload is specified
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
              console.error("No ID provided for update operation.");
              showFeedback("No ID provided for update.", "error");
            } else {
              response = await supabase.from(table).update(payload).eq("id", id);
            }
          } else if (operation === "delete") {
            if (!id) {
              console.error("No ID provided for delete operation.");
              showFeedback("No ID provided for delete.", "error");
            } else {
              response = await supabase.from(table).delete().eq("id", id);
            }
          }

          if (response && !response.error) {
            success = true;
            showFeedback(`CRUD ${operation} successful`, "success");
          } else if (response && response.error) {
            showFeedback(`Error: ${response.error.message}`, "error");
          }
        }

        // Handle refresh on success
        handleRefreshOnSuccess(success);

      } catch (error) {
        console.error("Error:", error);
        showFeedback(`Error: ${error.message}`, "error");
      } finally {
        setLoading(form, false);
      }
    });
  };

  // Handle actions triggered by non-form elements (e.g. buttons)
  const handleNonFormActions = () => {
    document.addEventListener("click", async (event) => {
      const el = event.target.closest("[bflow-sb-crud],[bflow-sb-auth],[bflow-sb-confirm]");
      if (!el || el.hasAttribute("bflow-sb-form")) return; // Forms handled by submit event

      // Confirmation is handled separately in the confirmation function, so skip if confirm attributes present
      if (el.hasAttribute("bflow-sb-confirm")) return;

      setLoading(el, true);
      let success = false;

      try {
        // Auth actions
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
            showFeedback(`Auth ${operation} successful`, "success");
            success = true;
            if (redirectUrl) window.location.href = redirectUrl;
          } else if (response && response.error) {
            showFeedback(`Error: ${response.error.message}`, "error");
          }

          await fetchCurrentUser();
        }

        // CRUD actions
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
            if (!id) showFeedback("No ID provided for update.", "error");
            else response = await supabase.from(table).update(payload).eq("id", id);
          } else if (operation === "delete") {
            if (!id) showFeedback("No ID provided for delete.", "error");
            else response = await supabase.from(table).delete().eq("id", id);
          }

          if (response && !response.error) {
            showFeedback(`CRUD ${operation} successful`, "success");
            success = true;
          } else if (response && response.error) {
            showFeedback(`Error: ${response.error.message}`, "error");
          }
        }

        handleRefreshOnSuccess(success);

      } catch (error) {
        console.error("Error:", error);
        showFeedback(`Error: ${error.message}`, "error");
      } finally {
        setLoading(el, false);
      }
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    await fetchCurrentUser();
    await checkPageAccess();
    await handleVisibility();
    await handleRoles();
    handleErrors();
    await handleDynamicContent();
    handleEventTracking();
    handleConfirmation();
    handleFormSubmission();
    handleNonFormActions();
  });
})();
