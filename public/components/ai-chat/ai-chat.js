/// ===========================
// INITIALIZATION UI
// ===========================
window.addEventListener("load", function() {
    document.getElementById("convoBox").style.visibility = "hidden";
    document.getElementById("DialogBox").style.visibility = "hidden";
});


// ===========================
// CONVERSATION MANAGEMENT
// ===========================
const convoBtn = document.getElementById("convoBtn");

convoBtn.addEventListener("click", function () {
    const box = document.getElementById("convoBox");
    const vis = getComputedStyle(box).visibility;

    if (vis === "hidden") {
        box.style.visibility = "visible";
    } else {
        box.style.visibility = "hidden";
    }
});

// ===========================
// TEXT INPUT
// ===========================
const textInput = document.getElementById("aiInput");

textInput.addEventListener("focus", function () {
    document.getElementById("convoBox").style.visibility = "hidden";
});

textInput.addEventListener("keydown", function (event) {
    // Submit on Enter (but allow Shift+Enter for new line)
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendAIMessage();
    }
});

// ===========================
// FILE INPUT
// ===========================
const fileInput = document.getElementById("aiFileInput");
const fileIndicator = document.getElementById("aiFileIndicator");
const fileNameEl = document.getElementById("aiFileName");
const removeFileBtn = document.getElementById("aiFileRemoveBtn");

fileInput.addEventListener("change", function () {
    const file = this.files[0];

    if (file) {
        fileNameEl.textContent = file.name;
        fileIndicator.style.display = "inline-flex";
    }
});

removeFileBtn.addEventListener("click", function () {
    fileInput.value = "";
    fileNameEl.textContent = "";
    fileIndicator.style.display = "none";
});

// ===========================
// VOICE INPUT
// ===========================
const audioInput = document.getElementById("aiAudioInput");
const audioIndicator = document.getElementById("aiAudioIndicator");
const audioNameEl = document.getElementById("aiAudioName");
const removeAudioBtn = document.getElementById("aiAudioRemoveBtn");
const micBtn = document.getElementById("aiAudioBtn");

let mediaRecorder;
let audioChunks = [];
let recording = false;

micBtn.addEventListener("click", async () => {
    if (!recording) {
        startRecording();
    } else {
        stopRecording();
    }
});

audioInput.addEventListener("change", function () {
    const file = this.files[0];

    if (file) {
        audioNameEl.textContent = "Audio";
        audioIndicator.style.display = "inline-flex";
    }
});

removeAudioBtn.addEventListener("click", function () {
    audioInput.value = "";
    audioNameEl.textContent = "";
    audioIndicator.style.display = "none";
});


//---------------------------------------//
// Markdown-Converter Functionality
//---------------------------------------//

//---------------------------------------//
// Markdown-Converter
//---------------------------------------//
// Configure markdown-it with syntax highlighting
const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,  // Let markdown handle line breaks properly
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return '<pre class="hljs"><code>' +
                       hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                       '</code></pre>';
            } catch (__) {}
        }
        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
});

// Helper function to replace marked.parse() calls
window.parseMarkdown = function(text) {
    return md.render(text);
};

//---------------------------------------//
// Conversation Funcitons
//---------------------------------------//
async function deleteConversation(convo_id) {
    // If the deleted convo is the active convo then resent the dialog window
    if (document.getElementById("activeConvoId").value == convo_id)
    {
        document.getElementById("DialogBox").style.visibility = "hidden";
        document.getElementById("dialogWindow").innerHTML = "";
    }

    const res = await fetch("/api/ai-conversation/delete/", {
        method: "POST",
        headers: {
            "X-CSRFToken": getCookie("csrftoken")
        },
        body: new URLSearchParams({ convo_id: convo_id })
    });
    const data = await res.json();
    document.getElementById(convo_id)?.remove();
    return data;
}

async function openConversation(convo_id, convo_name) {
    const formData = new FormData();

    // Update selected convo item UI indicator
    updateSelectedConversation(convo_id, convo_name);

    formData.append("convo_id", convo_id);

    const res = await fetch("/api/get-messages/", {
        method: "POST",
        body: formData,
        headers: {
            "X-CSRFToken": getCookie("csrftoken"),
        },
    });

    const data = await res.json();

    const dialog = document.getElementById("dialogWindow");
    dialog.innerHTML = "";
    document.getElementById("activeConvoId").value = convo_id; // update the current conversation
    
    data.messages.forEach(msg => {
        let fileLink = "";
        if (msg.file) {
            fileLink = `
                <div class="file-download">
                    <a href="/api/download/${msg.id}/" class="file-link" target="_blank">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                            stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2v6h6"
                            stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${msg.file}</span>
                    </a>
                </div>
            `;
        }
        dialog.innerHTML += `
            <div class="user-prompt app-font-family app-background app-font-color">${msg.message}</div>
            <div class="ai-response">
                ${parseMarkdown(msg.response)}
                ${fileLink}
            </div>
        `;
    });
    dialog.scrollTop = dialog.scrollHeight;
}

function updateConversationList(convo_id, convo_name) {
    const exists = document.getElementById(convo_id);
    if (exists) exists.remove();

    document.getElementById("convoNames").innerHTML =
        `
        <div id="${convo_id}" class="convo-item">
            <button class="convo-btn" onclick="openConversation(${convo_id}, '${convo_name.replace(/'/g, "\\'")}')">
                ${convo_name}
            </button>
            <button class="remove-btn" onclick="deleteConversation(${convo_id})">x</button>
        </div>
        ` + document.getElementById("convoNames").innerHTML;
    document.getElementById(convo_id).classList.add("active-convo-item");
}

function updateSelectedConversation(convo_id, convo_name) {
    const activeConvoId = document.getElementById("activeConvoId")?.value;
    if (activeConvoId) 
        document.getElementById(activeConvoId).classList.remove("active-convo-item");
    document.getElementById(convo_id).classList.add("active-convo-item");
    document.getElementById("convoBox").style.visibility = "hidden";
    document.getElementById("activeConvoName").innerHTML = convo_name;
    document.getElementById("DialogBox").style.visibility = "visible";
}

//---------------------------------------//
// Audio Functions
//---------------------------------------//
async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    audioChunks = [];
    recording = true;
    micBtn.classList.add("listening");

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

        // Convert Blob → File (important!)
        const audioFile = new File([audioBlob], "recording.webm", {
            type: "audio/webm",
        });

        // Insert File into the hidden <input type="file">
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(audioFile);
        audioInput.files = dataTransfer.files;

        // Trigger your file UI indicator if needed
        showAudioIndicator();
    };

    mediaRecorder.start();
}

function stopRecording() {
    recording = false;
    micBtn.classList.remove("listening");
    mediaRecorder.stop();
}

function showAudioIndicator() {
    const audioIndicator = document.getElementById("aiAudioIndicator");
    const audioNameEl = document.getElementById("aiAudioName");

    audioNameEl.textContent = "Audio";
    audioIndicator.style.display = "inline-flex";
}

//---------------------------------------//
// Message Funcitons
//---------------------------------------//
async function stream(response, container, msgId, fileName) {
    // Create AI message container
    const aiDiv = document.createElement("div");
    aiDiv.className = "ai-response";
    container.appendChild(aiDiv);

    // Streaming reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let finalizedHTML = "";  // all markdown-confirmed content

    aiDiv.innerHTML = ""; // ensure clean

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        buffer += chunk;

        // Show preview (raw text)
        aiDiv.innerHTML = finalizedHTML + buffer;

        // --- 1. Finalize at punctuation boundary ---
        const endsSentence = /[.!?]\s$/.test(buffer);

        // --- 2. Finalize when a NEW header begins ---
        // const newHeader = buffer.includes("\n#");

        if (endsSentence) {
            // Append to finalized HTML
            finalizedHTML += parseMarkdown(buffer);
            // Clear the preview buffer
            buffer = "";
            // Update UI to finalized MD
            aiDiv.innerHTML = finalizedHTML;
        }
        container.scrollTop = container.scrollHeight;
    }

    // Render leftovers
    if (buffer.length > 0) {
        finalizedHTML += parseMarkdown(buffer);
        aiDiv.innerHTML = finalizedHTML;
        let fileLink = "";
            if (fileName) {
                fileLink = `
                    <div class="file-download">
                        <a href="/api/download/${msgId}/" class="file-link" target="_blank">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                                stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M14 2v6h6"
                                stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>${fileName}</span>
                        </a>
                    </div>
                `;
            }
        aiDiv.innerHTML += fileLink;
    }
}

async function sendAIMessage() {
    document.getElementById("DialogBox").style.visibility = "visible";

    const textInput = document.getElementById("aiInput");
    const fileInput = document.getElementById("aiFileInput");
    const audioInput = document.getElementById("aiAudioInput");
    const dialog = document.getElementById("dialogWindow");

    let message = textInput.value.trim();
    let convo_id = document.getElementById("activeConvoId").value;

    if (!message && audioInput.files.length === 0 && fileInput.files.length === 0) {
        return; // nothing to send
    }

    // ------------ ADD USER MESSAGE TO UI ---------------
    if (message) {
        dialog.innerHTML += `<div class="user-prompt app-background app-font-family app-font-color">${message}</div>`;
    }
    dialog.scrollTop = dialog.scrollHeight;
    textInput.value = "";

    // ------------- BUILD FORM DATA ---------------------
    const formData = new FormData();
    formData.append("convo_id", convo_id);
    formData.append("history", dialog.innerText);
    formData.append("message", message);

    if (fileInput.files.length > 0) {
        formData.append("file", fileInput.files[0]);
    }

    if (audioInput.files.length > 0) {
        formData.append("audio", audioInput.files[0]);
    }

    // ------------- STREAM RESPONSE ----------------------
    const response = await fetch("/api/ai-message/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: formData
    });

    // READ HEADERS BEFORE STREAMING
    const convoId = response.headers.get("X-Convo-ID");
    const convoName = response.headers.get("X-Convo-Name");
    const msgId = response.headers.get("X-Message-ID");
    const fileName = response.headers.get("X-File-Name");
    const audioTranscript = response.headers.get("X-Audio-Trans")

    if (!message && audioTranscript) {
        dialog.innerHTML += `<div class="user-prompt app-background app-font-family app-font-color">${audioTranscript}</div>`;
    }

    // UPDATE UI / HIDDEN INPUT
    document.getElementById("activeConvoId").value = convoId;

    updateConversationList(convoId, convoName);
    updateSelectedConversation(convoId, convoName);

    stream(response, dialog, msgId, fileName); // your existing streaming function

    // ------------- CLEAR FILE UI ------------------------
    fileInput.value = "";
    audioInput.value = "";

    document.getElementById("aiFileIndicator").style.display = "none";
    document.getElementById("aiAudioIndicator").style.display = "none";
}