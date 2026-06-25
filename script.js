// State Management & Constants
const API_URL = "https://solar-yojna.fastapicloud.dev/ask";
const THEME_KEY = "solar-yojna-theme";
const HISTORY_KEY = "solar-yojna-history";
const MODEL_KEY = "solar-yojna-model";

let currentSessionId = null;
let historyData = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let activeModel = localStorage.getItem(MODEL_KEY) || "solar-pro";

// Elements
const chatBox = document.getElementById("chat-box");
const questionInput = document.getElementById("question");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const themeBtn = document.getElementById("themeBtn");
const newChatBtn = document.getElementById("newChatBtn");
const topbarModelIndicator = document.getElementById("topbar-model-indicator");

// Navigation
const navBtns = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view-content");

// History View elements
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// Settings View elements
const settingsModelSelect = document.getElementById("settings-model-select");
const themeToggleLight = document.getElementById("themeToggleLight");
const themeToggleDark = document.getElementById("themeToggleDark");
const resetAppBtn = document.getElementById("resetAppBtn");

// ===================================================================
// Theme Configuration
// ===================================================================

function applyTheme(theme) {
    const isLight = theme === "light";
    document.body.classList.toggle("light-mode", isLight);

    // Update topbar icon
    themeBtn.innerHTML = isLight ? "☀️" : "🌙";
    themeBtn.setAttribute("aria-pressed", String(isLight));
    themeBtn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");

    // Sync settings buttons styling
    if (themeToggleLight && themeToggleDark) {
        themeToggleLight.classList.toggle("active", isLight);
        themeToggleDark.classList.toggle("active", !isLight);
    }
}

function getPreferredTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
}

// Initial Theme load
applyTheme(getPreferredTheme());

// ===================================================================
// Navigation & Views Controller
// ===================================================================

function switchView(viewId) {
    views.forEach(view => {
        view.classList.toggle("active", view.id === viewId);
    });

    navBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-view") === viewId);
    });

    // View specific actions
    if (viewId === "history-view") {
        renderHistory();
    } else if (viewId === "settings-view") {
        syncSettingsUI();
    }
}

// Bind navigation clicks
navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const viewId = btn.getAttribute("data-view");
        switchView(viewId);
    });
});

// Topbar model indicator click redirects to Settings
if (topbarModelIndicator) {
    topbarModelIndicator.addEventListener("click", () => {
        switchView("settings-view");
    });
}

// ===================================================================
// Chat Sessions & History Persistence
// ===================================================================

function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData));
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (historyData.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <i class="fa-solid fa-clock-rotate-left empty-icon"></i>
                <p>No recent conversations found. Start a chat to save your history!</p>
            </div>
        `;
        return;
    }

    historyData.forEach(session => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.setAttribute("data-id", session.id);

        const dateStr = new Date(session.timestamp).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        item.innerHTML = `
            <div class="history-item-info">
                <span class="history-item-title"></span>
                <span class="history-item-date">${dateStr}</span>
            </div>
            <div class="history-item-actions">
                <button class="delete-session-btn" title="Delete conversation">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        // Safe insertion of titles to avoid HTML injection
        item.querySelector(".history-item-title").textContent = session.title;

        // Load session on clicking card (excluding delete button)
        item.addEventListener("click", (e) => {
            if (e.target.closest(".delete-session-btn")) return;
            loadSession(session.id);
        });

        // Delete session handler
        const deleteBtn = item.querySelector(".delete-session-btn");
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        });

        historyList.appendChild(item);
    });
}

function loadSession(sessionId) {
    const session = historyData.find(s => s.id === sessionId);
    if (!session) return;

    currentSessionId = session.id;
    chatBox.innerHTML = "";

    session.messages.forEach(msg => {
        appendMessage(msg.role, msg.text, false); // Append without saving again
    });

    switchView("chat-view");
    chatBox.scrollTop = chatBox.scrollHeight;
}

function deleteSession(sessionId) {
    historyData = historyData.filter(s => s.id !== sessionId);
    saveHistory();

    if (currentSessionId === sessionId) {
        startNewChat(false); // Reset active screen silently
    }

    renderHistory();
}

function startNewChat(redirectToChat = true) {
    currentSessionId = null;
    chatBox.innerHTML = `
        <div class="bot-message">
            <span class="msg-avatar">☀️</span>
            <span class="msg-text">👋 Welcome! Ask me anything about PM Solar Yojana.</span>
        </div>
    `;

    if (redirectToChat) {
        switchView("chat-view");
        questionInput.focus();
    }
}

// Bind topbar new chat button
if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
        startNewChat(true);
    });
}

// Clear all history
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all chat histories? This action cannot be undone.")) {
            historyData = [];
            saveHistory();
            startNewChat(false);
            renderHistory();
        }
    });
}

// ===================================================================
// Message Rendering & API Interactions
// ===================================================================

function appendMessage(role, text, shouldSave = true) {
    const isUser = role === "user";
    const div = document.createElement("div");
    div.className = isUser ? "user-message" : "bot-message";

    const avatar = isUser ? "🙂" : "☀️";
    div.innerHTML = `
        <span class="msg-avatar">${avatar}</span>
        <span class="msg-text"></span>
    `;

    const textEl = div.querySelector(".msg-text");
    if (isUser) {
        textEl.textContent = text;
    } else {
        textEl.innerHTML = (typeof marked !== "undefined")
            ? marked.parse(text)
            : text;
    }

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (shouldSave && currentSessionId) {
        const session = historyData.find(s => s.id === currentSessionId);
        if (session) {
            session.messages.push({ role, text });
            session.timestamp = Date.now(); // Update last active timestamp
            saveHistory();
        }
    }

    return div;
}

async function askQuestion(prefill) {
    if (typeof prefill === "string") {
        questionInput.value = prefill;
    }

    const question = questionInput.value.trim();
    if (!question) return;

    // Force redirection to Chat view if user is sending a query from Home dashboard
    const isNotOnChat = !document.getElementById("chat-view").classList.contains("active");
    if (isNotOnChat) {
        switchView("chat-view");
    }

    // Initialize new session if not present
    if (!currentSessionId) {
        currentSessionId = "session_" + Date.now();
        const newSession = {
            id: currentSessionId,
            title: question.substring(0, 45) + (question.length > 45 ? "..." : ""),
            timestamp: Date.now(),
            messages: []
        };
        historyData.unshift(newSession);
        saveHistory();
    }

    // Append user message
    appendMessage("user", question);
    questionInput.value = "";
    setLoading(true);

    // Render typing loader
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "bot-message";
    loadingDiv.innerHTML = `
        <span class="msg-avatar">☀️</span>
        <span class="msg-text">
            <div class="typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </span>
    `;
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question })
        });

        if (!response.ok) {
            throw new Error(`HTTP error status: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.answer || "No response received.";

        // Remove loading state & append bot message
        loadingDiv.remove();
        appendMessage("bot", answer);

    } catch (error) {
        loadingDiv.remove();
        appendMessage("bot", "❌ Unable to connect to backend server. Make sure the FastAPI application is running locally.");
        console.error(error);
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    sendBtn.classList.toggle("loading", isLoading);
    sendBtn.disabled = isLoading;
    questionInput.disabled = isLoading;
}

// Bind Action buttons
sendBtn.addEventListener("click", () => askQuestion());

// Suggestions Chips clicks
document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => askQuestion(chip.textContent.trim()));
});

// Input textarea keydown listener (Enter to send)
questionInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askQuestion();
    }
});

// ===================================================================
// Settings & Model Controls
// ===================================================================

function syncSettingsUI() {
    // Sync model
    if (settingsModelSelect) {
        settingsModelSelect.value = activeModel;
    }

    // Sync indicator
    updateTopbarIndicator(activeModel);

    // Sync theme
    applyTheme(getPreferredTheme());
}

function updateTopbarIndicator(modelValue) {
    if (!topbarModelIndicator) return;
    const modelText = modelValue === "solar-lite" ? "Solar AI Lite" : "Solar AI Pro";
    topbarModelIndicator.innerHTML = `${modelText} ▾`;
}

// Initialize settings models sync
if (settingsModelSelect) {
    settingsModelSelect.addEventListener("change", (e) => {
        activeModel = e.target.value;
        localStorage.setItem(MODEL_KEY, activeModel);
        updateTopbarIndicator(activeModel);
    });
}

// Sync model on load
updateTopbarIndicator(activeModel);

// Theme buttons clicks in Settings
if (themeToggleLight) {
    themeToggleLight.addEventListener("click", () => {
        localStorage.setItem(THEME_KEY, "light");
        applyTheme("light");
    });
}

if (themeToggleDark) {
    themeToggleDark.addEventListener("click", () => {
        localStorage.setItem(THEME_KEY, "dark");
        applyTheme("dark");
    });
}

// Bind Topbar quick theme button (rotates light/dark)
themeBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("light-mode") ? "dark" : "light";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
});

// Reset App button
if (resetAppBtn) {
    resetAppBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to reset the entire application? This will clear all settings, models, and saved chat history.")) {
            localStorage.clear();
            window.location.reload();
        }
    });
}

// ===================================================================
// Voice Input Integration
// ===================================================================

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";

    micBtn.addEventListener("click", () => {
        micBtn.classList.add("recording");
        recognition.start();
    });

    recognition.onresult = function (event) {
        questionInput.value = event.results[0][0].transcript;
    };

    recognition.onend = function () {
        micBtn.classList.remove("recording");
    };

    recognition.onerror = function () {
        micBtn.classList.remove("recording");
    };
} else {
    micBtn.addEventListener("click", () => {
        alert("Voice input isn't supported in this browser. Please use Chrome or Safari.");
    });
}