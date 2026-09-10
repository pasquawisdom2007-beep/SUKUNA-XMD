(() => {
  const panel = document.getElementById("panel");
  const views = {
    input: document.querySelector('[data-view="input"]'),
    loading: document.querySelector('[data-view="loading"]'),
    code: document.querySelector('[data-view="code"]'),
    connected: document.querySelector('[data-view="connected"]'),
    error: document.querySelector('[data-view="error"]'),
  };

  const phoneInput = document.getElementById("phone");
  const submitBtn = document.getElementById("submit");
  const hint = document.getElementById("hint");
  const codeValue = document.getElementById("codeValue");
  const copyBtn = document.getElementById("copyBtn");
  const statusText = document.getElementById("statusText");
  const statusDot = document.getElementById("statusDot");
  const errorText = document.getElementById("errorText");

  let currentSessionId = null;
  let pollTimer = null;

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
    panel.dataset.state = name;
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function requestCode() {
    const raw = phoneInput.value.trim();
    if (!raw) {
      hint.textContent = "Enter your number first, country code included.";
      hint.style.color = "var(--bad)";
      return;
    }

    submitBtn.disabled = true;
    showView("loading");

    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: raw }),
      });
      const data = await res.json();

      if (!res.ok) {
        errorText.textContent = data.error || "Couldn't generate a code. Please try again.";
        showView("error");
        submitBtn.disabled = false;
        return;
      }

      if (data.alreadyConnected) {
        currentSessionId = data.sessionId;
        showView("connected");
        submitBtn.disabled = false;
        return;
      }

      currentSessionId = data.sessionId;
      codeValue.textContent = data.code;
      showView("code");
      statusDot.classList.remove("ok");
      statusText.textContent = "Waiting for you to enter the code…";
      startPolling();
    } catch (err) {
      errorText.textContent = "Network error. Check your connection and try again.";
      showView("error");
    } finally {
      submitBtn.disabled = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (!currentSessionId) return;
      try {
        const res = await fetch(`/api/status/${encodeURIComponent(currentSessionId)}`);
        const data = await res.json();
        if (data.connected) {
          stopPolling();
          showView("connected");
        }
      } catch (_) {
        /* keep trying silently */
      }
    }, 4000);
  }

  submitBtn.addEventListener("click", requestCode);
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") requestCode();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeValue.textContent.trim());
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    } catch (_) {
      /* clipboard not available, ignore */
    }
  });

  document.getElementById("retry").addEventListener("click", () => {
    stopPolling();
    showView("input");
  });
  document.getElementById("restart").addEventListener("click", () => {
    stopPolling();
    phoneInput.value = "";
    showView("input");
  });
  document.getElementById("tryAgain").addEventListener("click", () => {
    showView("input");
  });
})();
