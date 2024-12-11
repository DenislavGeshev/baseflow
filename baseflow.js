(() => {
  let currentUser = null;
  let notificationParent = null;

  // Find notification parent
  const findNotificationParent = () => {
    const el = document.querySelector("[bflow-sb-notification-parent='true']");
    return el || document.body;
  };

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
      console.error("Supabase not defined. Initialize it before this script.");
      return null;
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error("Error fetching user:", error);
    currentUser = user;
    return user;
  };

  const setLoading = (element, loading) => {
    if (!element) return;
    const loadingAttr = element.getAttribute("bflow-sb-loading");
    if (loadingAttr === "true") {
      element.disabled = loading;
      element.style.opacity = loading ? "0.5" : "1";
    }
  };

  const handleAuthOperation = async (operation, payload, redirectUrl) => {
    let response;
    let successMsg;
    let errorMsg = "An error occurred.";
    try {
      switch (operation) {
        case "signup":
          response = await supabase.auth.signUp({ email: payload.email, password: payload.password });
          successMsg = "Sign up successful!";
          break;
        case "login":
          response = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
          successMsg = "Login successful!";
          break;
        case "logout":
          response = await supabase.auth.signOut();
          successMsg = "Logged out successfully!";
          break;
        case "check":
          response = await supabase.auth.getUser();
          successMsg = response.data.user ? `User: ${response.data.user.email}` : "No user logged in.";
          break;
        case "reset-password":
          response = await supabase.auth.resetPasswordForEmail(payload.email);
          successMsg = "Password reset email sent!";
          break;
        case "otp-email":
          response = await supabase.auth.signInWithOtp({ email: payload.email });
          successMsg = "Magic link sent to email!";
          break;
        case "otp-phone":
          response = await supabase.auth.signInWithOtp({ phone: payload.phone });
          successMsg = "OTP sent to phone!";
          break;
        case "verify-otp":
          response = await supabase.auth.verifyOtp({ 
            phone: payload.phone, 
            email: payload.email,
            token: payload.token, 
            type: payload.type // 'sms' or 'magiclink'
          });
          successMsg = "OTP verified!";
          break;
        default:
          // For OAuth or custom operations, e.g. "oauth-github":
          if (operation.startsWith("oauth-")) {
            const provider = operation.split("-")[1];
            response = await supabase.auth.signInWithOAuth({ provider });
            successMsg = `OAuth to ${provider} started! Check redirect.`;
          } else {
            errorMsg = `Unknown operation: ${operation}`;
          }
      }

      if (response && response.error) {
        showNotification(response.error.message || errorMsg, "error");
      } else if (!response || response.error == null) {
        showNotification(successMsg, "success");
        await fetchCurrentUser(); // update currentUser
        if (redirectUrl) window.location.href = redirectUrl;
      }

    } catch (error) {
      console.error("Auth Error:", error);
      showNotification(`Error: ${error.message}`, "error");
    }
  };

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

  const handleFormSubmission = () => {
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[bflow-sb-form='auth']");
      if (!form) return;
      event.preventDefault();
      setLoading(form, true);

      const operation = form.getAttribute("bflow-sb-auth");
      const redirectUrl = form.getAttribute("bflow-sb-auth-redirect");
      const payload = getFormPayload(form);

      await handleAuthOperation(operation, payload, redirectUrl);

      setLoading(form, false);
    });
  };

  const handleNonFormActions = () => {
    document.addEventListener("click", async (event) => {
      const el = event.target.closest("[bflow-sb-auth]");
      if (!el) return;
      if (el.hasAttribute("bflow-sb-form")) return; // skip if part of a form; forms handled by submit event

      // If bflow-sb-confirm present, handle in a confirmation logic if implemented
      if (el.hasAttribute("bflow-sb-confirm")) return; 

      setLoading(el, true);
      const operation = el.getAttribute("bflow-sb-auth");
      const redirectUrl = el.getAttribute("bflow-sb-auth-redirect");
      const email = el.getAttribute("bflow-sb-auth-email");
      const password = el.getAttribute("bflow-sb-auth-password");
      const phone = el.getAttribute("bflow-sb-auth-phone");
      const token = el.getAttribute("bflow-sb-auth-token");
      const type = el.getAttribute("bflow-sb-auth-type"); // 'sms' or 'magiclink'

      const payload = { email, password, phone, token, type };

      await handleAuthOperation(operation, payload, redirectUrl);

      setLoading(el, false);
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (typeof supabase === 'undefined') {
      console.error("Supabase is not defined. Ensure it's initialized before loading this script.");
      return;
    }
    await fetchCurrentUser();
    handleFormSubmission();
    handleNonFormActions();
  });
})();
