const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");

const API_KEY = "AIzaSyAboS-boFtv2UFsBeKTRZG3L9aD6xAAFZQ";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

const scrollToBottom = () => container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth"
});

const typingEffect = (text, textElement, botMsgDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;

    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            botMsgDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
        }
    }, 30);
};

const generateResponse = async (botMsgDiv) => {
    const textElement = botMsgDiv.querySelector(".message-text");
    controller = new AbortController();

    chatHistory.push({
        role: "user",
        parts: [
            { text: userData.message },
            ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])
        ],
    });

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message || "Failed to get response");

        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();

        const processedText = processCodeBlocks(responseText);
        textElement.innerHTML = processedText;
        
        // Remove the incorrect Prism.highlightElement(block) line here
        // Instead, we'll handle code highlighting after the content is added to the DOM

        typingEffect(responseText, textElement, botMsgDiv);
        chatHistory.push({ role: "model", parts: [{ text: responseText }] });

        localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
        
        // Add setTimeout to allow DOM to update before highlighting
        setTimeout(() => {
            highlightCodeBlocks();
        }, 100);
        
    } catch (error) {
        textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : `Error: ${error.message}`;
        textElement.style.color = "#d62939";
        botMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
        setTimeout(() => {
            highlightCodeBlocks();
            scrollToBottom();
        }, 100);
    } finally {
        userData.file = {};
    }
};

const processCodeBlocks = (text) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)\n```/g;
    return text.replace(codeBlockRegex, (match, language, code) => {
        const langClass = language ? `language-${language}` : '';
        const langDisplay = language ? `<div class="code-header"><span class="code-language">${language}</span></div>` : '';

        return `
        <div class="code-block-wrapper">
          ${langDisplay}
          <pre class="code-block line-numbers ${langClass}"><code class="${langClass}">${escapeHTML(code)}</code>
          <div class="code-actions">
            <button class="copy-btn" title="Copy code"><span class="material-symbols-rounded">content_copy</span></button>
          </div></pre>
        </div>
      `;
    });
};

const escapeHTML = (text) => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const highlightCodeBlocks = () => {
    document.querySelectorAll('pre.code-block code').forEach((block) => {
        Prism.highlightElement(block);
    });
};

const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if (!userMessage || document.body.classList.contains("bot-responding")) return;

    userData.message = userMessage;
    promptInput.value = "";
    document.body.classList.add("chats-active", "bot-responding");
    fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

    const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data ? (userData.file.isImage ?
            `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" alt="User uploaded image" />` :
            `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
        ) : ""}
  `;

    const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
    userMsgDiv.querySelector(".message-text").textContent = userData.message;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    setTimeout(() => {
        const botMsgHTML = `<div class="avatar-container"><div class="avatar-inner"></div></div><p class="message-text">Thinking...</p>`;
        const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
    }, 400);
};

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

        userData.file = {
            fileName: file.name,
            data: base64String,
            mime_type: file.type,
            isImage
        };
    };
});

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});

document.querySelector("#stop-response-btn").addEventListener("click", () => {
    controller?.abort();
    userData.file = {};
    clearInterval(typingInterval);
    const loadingMessage = chatsContainer.querySelector(".bot-message.loading");
    if (loadingMessage) {
        loadingMessage.classList.remove("loading");
    }
    document.body.classList.remove("bot-responding");
});

themeToggleBtn.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    if (document.body.classList.contains("bot-responding")) {
        controller?.abort();
        clearInterval(typingInterval);
    }

    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("chats-active", "bot-responding");
    localStorage.removeItem("chatHistory");
});

document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
        promptInput.value = suggestion.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit"));
    });
});

document.addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide = target.classList.contains("prompt-input") ||
        (wrapper.classList.contains("hide-controls") &&
            (target.id === "add-file-btn" || target.id === "stop-response-btn"));
    wrapper.classList.toggle("hide-controls", shouldHide);

    if (target.classList.contains("copy-btn")) {
        const codeBlock = target.closest(".code-block");
        const codeText = codeBlock.querySelector("code").textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            target.innerHTML = `<span class="material-symbols-rounded">check</span>`;
            setTimeout(() => {
                target.innerHTML = `<span class="material-symbols-rounded">content_copy</span>`;
            }, 2000);
        });
    }
});

const exportChatHistory = () => {
    const chatData = JSON.stringify(chatHistory, null, 2);
    const blob = new Blob([chatData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const importChatHistory = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedHistory = JSON.parse(e.target.result);
            chatHistory.length = 0;
            chatHistory.push(...importedHistory);
            localStorage.setItem("chatHistory", JSON.stringify(chatHistory));

            chatsContainer.innerHTML = "";
            document.body.classList.add("chats-active");

            importedHistory.forEach(item => {
                if (item.role === "user") {
                    const userText = item.parts[0].text;
                    const userMsgDiv = createMessageElement(`<p class="message-text">${userText}</p>`, "user-message");
                    chatsContainer.appendChild(userMsgDiv);
                } else if (item.role === "model") {
                    const botText = item.parts[0].text;
                    const botMsgHTML = `<div class="avatar-container"><div class="avatar-inner"></div></div><p class="message-text">${processCodeBlocks(botText)}</p>`;
                    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message");
                    chatsContainer.appendChild(botMsgDiv);
                }
            });

            setTimeout(() => {
                highlightCodeBlocks();
                scrollToBottom();
            }, 100);

            showNotification("Chat history imported successfully", "success");
        } catch (error) {
            showNotification("Failed to import chat history", "error");
        }
    };
    reader.readAsText(file);
};

const showNotification = (message, type = "info") => {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
        setTimeout(() => {
            notification.classList.remove("show");
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }, 10);
};

const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
        showNotification("Speech recognition not supported in this browser", "error");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    const voiceBtn = document.querySelector("#voice-input-btn");
    voiceBtn.classList.add("recording");
    showNotification("Listening...", "info");

    let finalTranscript = '';

    recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        promptInput.value = finalTranscript || interimTranscript;
    };

    recognition.onend = () => {
        voiceBtn.classList.remove("recording");
        if (finalTranscript) {
            promptForm.dispatchEvent(new Event("submit"));
        }
    };

    recognition.onerror = (event) => {
        voiceBtn.classList.remove("recording");
        showNotification(`Error: ${event.error}`, "error");
    };

    recognition.start();
};

const createActionButtons = () => {
    const actionButtonsDiv = document.createElement("div");
    actionButtonsDiv.className = "action-buttons";

    const exportBtn = document.createElement("button");
    exportBtn.id = "export-chat-btn";
    exportBtn.className = "action-btn";
    exportBtn.innerHTML = '<span class="material-symbols-rounded">download</span>';
    exportBtn.title = "Export Chat History";
    exportBtn.addEventListener("click", exportChatHistory);

    const importBtn = document.createElement("button");
    importBtn.id = "import-chat-btn";
    importBtn.className = "action-btn";
    importBtn.innerHTML = '<span class="material-symbols-rounded">upload</span>';
    importBtn.title = "Import Chat History";

    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".json";
    importInput.style.display = "none";
    importInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            importChatHistory(e.target.files[0]);
        }
    });

    importBtn.addEventListener("click", () => importInput.click());

    const voiceBtn = document.createElement("button");
    voiceBtn.id = "voice-input-btn";
    voiceBtn.className = "action-btn";
    voiceBtn.innerHTML = '<span class="material-symbols-rounded">mic</span>';
    voiceBtn.title = "Voice Input";
    voiceBtn.addEventListener("click", handleVoiceInput);

    actionButtonsDiv.appendChild(exportBtn);
    actionButtonsDiv.appendChild(importBtn);
    actionButtonsDiv.appendChild(voiceBtn);
    actionButtonsDiv.appendChild(importInput);

    document.querySelector(".prompt-container").appendChild(actionButtonsDiv);
};

window.addEventListener("load", () => {
    const savedHistory = localStorage.getItem("chatHistory");
    if (savedHistory) {
        try {
            const parsedHistory = JSON.parse(savedHistory);
            if (parsedHistory.length > 0) {
                chatHistory.push(...parsedHistory);
                document.body.classList.add("chats-active");

                parsedHistory.forEach(item => {
                    if (item.role === "user") {
                        const userText = item.parts[0].text;
                        const userMsgDiv = createMessageElement(`<p class="message-text">${userText}</p>`, "user-message");
                        chatsContainer.appendChild(userMsgDiv);
                    } else if (item.role === "model") {
                        const botText = item.parts[0].text;
                        const botMsgHTML = `<div class="avatar-container"><div class="avatar-inner"></div></div><p class="message-text">${processCodeBlocks(botText)}</p>`;
                        const botMsgDiv = createMessageElement(botMsgHTML, "bot-message");
                        chatsContainer.appendChild(botMsgDiv);
                    }
                });

                setTimeout(() => {
                    highlightCodeBlocks();
                    scrollToBottom();
                }, 100);
            }
        } catch (e) {
            console.error("Error loading chat history:", e);
        }
    }

    createActionButtons();
});

const setupFeedbackSystem = () => {
    document.addEventListener("click", (e) => {
        if (!e.target.classList.contains("feedback-btn")) return;

        const messageEl = e.target.closest(".bot-message");
        const feedbackBtns = messageEl.querySelectorAll(".feedback-btn");
        feedbackBtns.forEach(btn => btn.classList.remove("active"));
        e.target.classList.add("active");

        const feedbackType = e.target.dataset.type;
        const messageIndex = Array.from(chatsContainer.querySelectorAll(".bot-message")).indexOf(messageEl);

        if (chatHistory[messageIndex * 2 + 1]) {
            chatHistory[messageIndex * 2 + 1].feedback = feedbackType;
            localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
        }

        showNotification(`Thank you for your ${feedbackType} feedback!`, "success");
    });
};

const addFeedbackButtons = (botMsgDiv) => {
    const feedbackContainer = document.createElement("div");
    feedbackContainer.className = "feedback-container";

    const thumbsUp = document.createElement("button");
    thumbsUp.className = "feedback-btn";
    thumbsUp.dataset.type = "positive";
    thumbsUp.innerHTML = '<span class="material-symbols-rounded">thumb_up</span>';

    const thumbsDown = document.createElement("button");
    thumbsDown.className = "feedback-btn";
    thumbsDown.dataset.type = "negative";
    thumbsDown.innerHTML = '<span class="material-symbols-rounded">thumb_down</span>';

    feedbackContainer.appendChild(thumbsUp);
    feedbackContainer.appendChild(thumbsDown);
    botMsgDiv.appendChild(feedbackContainer);
};

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("bot-responding")) {
        document.querySelector("#stop-response-btn").click();
    }

    if (e.key === "/" && !document.body.classList.contains("bot-responding") && document.activeElement !== promptInput) {
        e.preventDefault();
        promptInput.focus();
    }
});

setupFeedbackSystem();