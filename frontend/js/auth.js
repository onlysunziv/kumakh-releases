document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const loginError = document.getElementById("loginError");
  const loginBtn = document.getElementById("loginBtn");

  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    const icon = document.getElementById("toggleIcon");
    if (icon) {
      icon.classList.toggle("bi-eye", !isPassword);
      icon.classList.toggle("bi-eye-slash", isPassword);
    } else togglePasswordBtn.textContent = isPassword ? "Hide" : "Show";
    togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    togglePasswordBtn.setAttribute("aria-pressed", String(isPassword));
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    loginError.textContent = "";
    loginBtn.disabled = true;
    loginBtn.classList.add("is-loading");

    try {
      const response = await window.kumakhApi.authenticateUser({
        username,
        password,
      });
      if (!response || !response.success || !response.data) {
        throw new Error((response && response.message) || "Invalid username or password.");
      }

      const user = response.data;
      const sessionData = {
        isAuthenticated: true,
        userId: user.userId || user.username,
        username: user.username,
        fullName: user.fullName || user.username,
        role: String(user.role || "CASHIER").toUpperCase(),
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        sessionToken: user.sessionToken || "",
        reportsSessionToken: user.reportsSessionToken || "",
        loginAt: user.loginAt || new Date().toISOString(),
      };
      window.sessionStorage.removeItem("kumakhReportSession");
      window.sessionStorage.setItem("kumakhSession", JSON.stringify(sessionData));
      window.location.href = "index.html";
    } catch (error) {
      loginError.textContent = error.message || "Unable to sign in.";
      loginBtn.disabled = false;
      loginBtn.classList.remove("is-loading");
    }
  });
});
