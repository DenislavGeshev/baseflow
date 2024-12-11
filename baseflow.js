(() => {
  let currentUser = null;
  let notificationParent = null;

  /**
   * Utility: Find notification parent
   */
  const findNotificationParent = () => {
    const el = document.querySelector("[bflow-fb-notification-parent='true']");
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
    const loadingAttr = element.getAttribute("bflow-fb-loading");
    if (loadingAttr === "true") {
      element.disabled = loading;
      element.style.opacity = loading ? "0.5" : "1";
    }
  };

  /**
   * Fetch Current User
   */
  const fetchCurrentUser = async () => {
    currentUser = auth.currentUser;
    return currentUser;
  };

  /**
   * Page-Level Access: Redirect if user doesn't match required access
   */
  const checkPageAccess = async () => {
    const body = document.querySelector("body");
    if (!body) return;
    const requiredAccess = body.getAttribute("bflow-fb-page-access");
    const redirectUrl = body.getAttribute("bflow-fb-page-redirect");
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

  /**
   * Visibility based on user state
   */
  const handleVisibility = async () => {
    const elements = document.querySelectorAll("[bflow-fb-visibility]");
    await fetchCurrentUser();
    elements.forEach(el => {
      const visibility = el.getAttribute("bflow-fb-visibility");
      const hideIf = el.getAttribute("bflow-fb-visibility-hide-if") === "true";
      let shouldHide = false;

      if (visibility === "authenticated") shouldHide = !currentUser;
      if (visibility === "unauthenticated") shouldHide = !!currentUser;

      const finalHide = hideIf ? shouldHide : !shouldHide;
      el.style.display = finalHide ? "none" : "";
    });
  };

  /**
   * Dynamic Content Rendering
   */
  const handleDynamicContent = async () => {
    const elements = document.querySelectorAll("[bflow-fb-content='dynamic']");
    await fetchCurrentUser();
    for (const el of elements) {
      const collection = el.getAttribute("bflow-fb-content-collection");
      const field = el.getAttribute("bflow-fb-content-field");
      if (!collection || !field) continue;
      try {
        const querySnapshot = await db.collection(collection).get();
        const data = querySnapshot.docs.map(doc => doc.data()[field]).join(", ");
        el.innerText = data;
      } catch (err) {
        console.error("Error fetching dynamic content:", err);
        showNotification("Error loading content", "error");
      }
    }
  };

  /**
   * Authentication Operations
   */
  const handleAuthOperation = async (operation, payload) => {
    try {
      if (operation === "signup") {
        await auth.createUserWithEmailAndPassword(payload.email, payload.password);
        showNotification("Sign up successful! Please check your email.", "success");
      } else if (operation === "login") {
        await auth.signInWithEmailAndPassword(payload.email, payload.password);
        showNotification("Login successful!", "success");
      } else if (operation === "logout") {
        await auth.signOut();
        showNotification("Logged out successfully!", "success");
      } else if (operation === "reset-password") {
        await auth.sendPasswordResetEmail(payload.email);
        showNotification("Password reset email sent!", "success");
      }
      await fetchCurrentUser();
    } catch (error) {
      console.error("Auth Error:", error);
      showNotification(`Error: ${error.message}`, "error");
    }
  };

  /**
   * CRUD Operations
   */
  const handleCrudOperation = async (operation, collection, id, payload) => {
    try {
      if (operation === "create") {
        await db.collection(collection).add(payload);
        showNotification("Document created successfully!", "success");
      } else if (operation === "read") {
        const doc = await db.collection(collection).doc(id).get();
        if (doc.exists) {
          console.log("Document data:", doc.data());
          showNotification("Document read successfully!", "success");
        } else {
          showNotification("No such document!", "error");
        }
      } else if (operation === "update") {
        await db.collection(collection).doc(id).update(payload);
        showNotification("Document updated successfully!", "success");
      } else if (operation === "delete") {
        await db.collection(collection).doc(id).delete();
        showNotification("Document deleted successfully!", "success");
      }
    } catch (error) {
      console.error("CRUD Error:", error);
      showNotification(`Error: ${error.message}`, "error");
    }
  };

  /**
   * Handle Form Submissions
   */
  const handleFormSubmissions = () => {
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[bflow-fb-form]");
      if (!form) return;

      event.preventDefault();
      setLoading(form, true);

      const formType = form.getAttribute("bflow-fb-form");
      const payload = {};
      form.querySelectorAll("[bflow-fb-input]").forEach(input => {
        const field = input.getAttribute("bflow-fb-input");
        payload[field] = input.value;
      });

      if (formType === "auth") {
        const operation = form.getAttribute("bflow-fb-auth");
        await handleAuthOperation(operation, payload);
      } else if (formType === "crud") {
        const operation = form.getAttribute("bflow-fb-crud");
        const collection = form.getAttribute("bflow-fb-crud-collection");
        const id = form.getAttribute("bflow-fb-crud-id");
        await handleCrudOperation(operation, collection, id, payload);
      }

      setLoading(form, false);
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    await fetchCurrentUser();
    await checkPageAccess();
    await handleVisibility();
    await handleDynamicContent();
    handleFormSubmissions();
  });
})();
