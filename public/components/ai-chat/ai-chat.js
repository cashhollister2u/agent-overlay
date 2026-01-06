(function () {
  window.__components = window.__components || {};

  class AiChat {
    constructor(root, props = {}) {
      this.root = root;
      this.props = props;

      // --- scoped element lookups (IMPORTANT) ---
      const $ = (sel) => this.root.querySelector(sel);

      this.dialogBox = $('[data-role="dialogBox"]');
      this.dialogWindow = $('[data-role="dialogWindow"]');

      this.convoBox = $('[data-role="convoBox"]');
      this.convoNames = $('[data-role="convoNames"]');
      this.activeConvoId = $('[data-role="activeConvoId"]');

      this.convoTitle = ""
      this.convoTitleLimit = 25

      this.textInput = $('[data-role="textInput"]');

      this.fileInput = $('[data-role="fileInput"]');
      this.fileIndicator = $('[data-role="fileIndicator"]');
      this.fileNameEl = $('[data-role="fileName"]');

      this.audioInput = $('[data-role="audioInput"]');
      this.audioIndicator = $('[data-role="audioIndicator"]');
      this.audioNameEl = $('[data-role="audioName"]');

      this.mediaRecorder = null;
      this.audioChunks = [];
      this.recording = false;

      this.loading = false
      this.loadingIndicator = null

      this.messageId = null

      this.history = []

      // If you have a global cookie helper, use it; else pass in via props
      this.getCookie = props.getCookie || window.getCookie;
      this.parseMarkdown = props.parseMarkdown || window.parseMarkdown || ((t) => this.escapeHtml(t));

      this.bindEvents();

      // initial state
      this.convoBox.style.visibility = "hidden";
      this.dialogBox.style.visibility = "hidden";

      this.init();
    }

    async init() {
      // Load Conversations
      const conversations = await window.overlayAPI.getConversations();
      let recentId = null;
      let recentName = null
      conversations.forEach((convo) => {
        this.updateConversationList(convo.id, convo.title);
        recentId = convo.id;
        recentName = convo.title;
      })

      this.sendAIMessage("Call your available tools tool and list the output", false)
    }

    bindEvents() {
      // One delegated listener for all buttons (CSP-friendly, scalable)
      this.root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;

        switch (action) {
          case "toggleConvo":
            this.toggleConvoBox();
            break;
          case "openFilePicker":
            this.fileInput.click();
            break;
          case "toggleMic":
            this.toggleMic();
            break;
          case "removeFile":
            this.clearFile();
            break;
          case "removeAudio":
            this.clearAudio();
            break;
          case "send":
            this.sendAIMessage();
            break;
          default:
            break;
        }
      });

      this.textInput.addEventListener("focus", () => {
        this.convoBox.style.visibility = "hidden";
      });

      this.textInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.sendAIMessage();
        }
      });

      this.fileInput.addEventListener("change", () => {
        const file = this.fileInput.files?.[0];
        if (file) {
          this.fileNameEl.textContent = file.name;
          this.fileIndicator.style.display = "inline-flex";
        }
      });

      this.audioInput.addEventListener("change", () => {
        const file = this.audioInput.files?.[0];
        if (file) {
          this.audioNameEl.textContent = "Audio";
          this.audioIndicator.style.display = "inline-flex";
        }
      });
    }

    toggleConvoBox() {
      const vis = getComputedStyle(this.convoBox).visibility;
      this.convoBox.style.visibility = vis === "hidden" ? "visible" : "hidden";
    }

    clearFile() {
      this.fileInput.value = "";
      this.fileNameEl.textContent = "";
      this.fileIndicator.style.display = "none";
    }

    clearAudio() {
      this.audioInput.value = "";
      this.audioNameEl.textContent = "Audio";
      this.audioIndicator.style.display = "none";
    }

    escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str ?? "";
      return div.innerHTML;
    }

    appendUserPrompt(text) {
      const div = document.createElement("div");
      div.className = "user-prompt app-background app-font-family app-font-color";
      div.textContent = text;
      this.dialogWindow.appendChild(div);
    }

    appendAiResponse(htmlString, fileLinkEl = null) {
      const div = document.createElement("div");
      div.className = "ai-response";
      div.innerHTML = htmlString; 
      if (fileLinkEl) div.appendChild(fileLinkEl);
      this.dialogWindow.appendChild(div);
    }

    buildFileLink(msgId, fileName) {
      const wrap = document.createElement("div");
      wrap.className = "file-download";

      const a = document.createElement("a");
      a.className = "file-link";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.href = `/api/download/${msgId}/`;

      const span = document.createElement("span");
      span.textContent = fileName;

      a.appendChild(span);
      wrap.appendChild(a);
      return wrap;
    }

    // IMPORTANT: make convo items instance-local; do NOT use element id=convoId
    updateConversationList(convoId, convoName) {
      // remove existing item with same convoId
      const existing = this.convoNames.querySelector(`[data-convo-id="${String(convoId)}"]`);
      if (existing) existing.remove();

      const item = document.createElement("div");
      item.classList.add('convo-item')
      item.dataset.convoId = String(convoId);

      const openBtn = document.createElement("button");
      openBtn.classList.add("convo-btn");

      openBtn.type = "button";
      openBtn.textContent = convoName;
      openBtn.addEventListener("click", () => this.openConversation(convoId, convoName));

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.type = "button";
      removeBtn.textContent = "x";
      removeBtn.addEventListener("click", () => this.deleteConversation(convoId));

      item.appendChild(openBtn);
      item.appendChild(removeBtn);

      this.convoNames.prepend(item);
      this.setActiveConvo(convoId);
    }

    setActiveConvo(convoId) {
      // clear previous active class within THIS component only
      this.convoNames.querySelectorAll(".active-convo-item").forEach((el) => {
        el.classList.remove("active-convo-item");
      });

      const activeItem = this.convoNames.querySelector(`[data-convo-id="${String(convoId)}"]`);
      if (activeItem) activeItem.classList.add("active-convo-item");

      this.activeConvoId.value = String(convoId);

      this.convoBox.style.visibility = "hidden";
      this.dialogBox.style.visibility = "visible";
    }

    async deleteConversation(convoId) {
      if (this.activeConvoId.value === String(convoId)) {
        this.dialogBox.style.visibility = "hidden";
        this.dialogWindow.replaceChildren();
      }

      const res = await fetch("/api/ai-conversation/delete/", {
        method: "POST",
        headers: { "X-CSRFToken": this.getCookie?.("csrftoken") },
        body: new URLSearchParams({ convo_id: convoId }),
      });

      this.convoNames.querySelector(`[data-convo-id="${String(convoId)}"]`)?.remove();
      return res.json();
    }

    async openConversation(convoId, convoName) {
      window.overlayAPI.removeChatListeners(this.messageId);

      this.setActiveConvo(convoId, convoName);

      const formData = new FormData();
      formData.append("convo_id", convoId);

      const messages = await window.overlayAPI.getMessages(this.activeConvoId.value);

      this.dialogWindow.replaceChildren();

      (messages || []).forEach((msg) => {
        this.appendUserPrompt(msg.message);

        const fileLinkEl = msg.file ? this.buildFileLink(msg.id, msg.file) : null;
        this.appendAiResponse(msg.ai_response, fileLinkEl);
      });

      this.dialogWindow.scrollTop = this.dialogWindow.scrollHeight;
    }

    async toggleMic() {
      if (!this.recording) {
        await this.startRecording();
      } else {
        this.stopRecording();
      }
    }

    async startRecording() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      this.audioChunks = [];
      this.recording = true;

      this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "recording.webm", { type: "audio/webm" });

        const dt = new DataTransfer();
        dt.items.add(audioFile);
        this.audioInput.files = dt.files;

        this.audioNameEl.textContent = "Audio";
        this.audioIndicator.style.display = "inline-flex";
      };

      this.mediaRecorder.start();
    }

    stopRecording() {
      this.recording = false;
      this.mediaRecorder?.stop();
    }

    async highlightCodeBlocks(container) {
      const codeBlocks = container.querySelectorAll('pre code');

      for (const codeEl of codeBlocks) {
        // Skip if already highlighted (important if you ever enable chunk-highlighting)
        if (codeEl.dataset.hljsDone === "1") continue;

        const rawCode = codeEl.textContent ?? "";

        // If marked added a language-xxx class, pass it through (optional)
        const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
        const language = langClass ? langClass.replace('language-', '') : undefined;

        const { html, language: detected } = await window.overlayAPI.highlight(rawCode, language);

        codeEl.innerHTML = html;           
        codeEl.classList.add('hljs');      // hljs theme selectors use this
        codeEl.dataset.hljsDone = "1";

        // If you want, add detected language as a class
        if (detected) codeEl.classList.add(`language-${detected}`);
      }
    }

    async stream(conversationId, message, file, systemMsg) {
      const aiDiv = document.createElement("div");
      aiDiv.className = "ai-response";
      this.dialogWindow.appendChild(aiDiv);

      let buffer = "";

      window.overlayAPI.listenToChatStream(this.messageId, {
        onToolCall: async (toolName) => {
          console.log('tool name:', toolName)
          this.setLoadingText(toolName)
        },
        onChunk: async (chunk) => {
          buffer += chunk;
          aiDiv.innerHTML = await window.overlayAPI.marked(buffer);
          this.dialogWindow.scrollTop = this.dialogWindow.scrollHeight;
        },
        onEnd: async () => {
          if (this.loading) {
            await this.setLoading(this.dialogWindow, false)
          }
          aiDiv.innerHTML = await window.overlayAPI.marked(buffer);
          await this.highlightCodeBlocks(aiDiv);
          window.overlayAPI.removeChatListeners(this.messageId);
          this.dialogWindow.scrollTop = this.dialogWindow.scrollHeight;

          // Add the AI response to the database
          if (!systemMsg) await window.overlayAPI.addMessage(this.messageId, conversationId, message, aiDiv.innerHTML, file)
        },
        onError: (err) => {
          aiDiv.innerHTML += `<div class="error">Error: ${err}</div>`;
          window.overlayAPI.removeChatListeners(this.messageId);
        }
      });
    }

    async setLoadingText(text) {
      const el = this.loadingIndicator?.querySelector(".loading-text");
      if (el) el.textContent = text;
    }

    async setLoading(container, isLoading) {
      this.loading = isLoading

      if (isLoading) {
        this.loadingIndicator = document.createElement('div')
        this.loadingIndicator.classList.add('chat-loading')

        const spinner = document.createElement("div");
        spinner.classList.add("line-spinner");

        for (let i = 0; i < 12; i++) {
          const line = document.createElement("span");
          line.style.transform = `rotate(${i * 30}deg) translate(0, -8px)`;
          line.style.animationDelay = `${i * 0.08}s`;
          spinner.appendChild(line);
        }


        const loadingText = document.createElement("div");
        loadingText.classList.add("loading-text");
        loadingText.classList.add('app-font-color-2')
        loadingText.textContent = "Loading...";

        this.loadingIndicator.appendChild(spinner);
        this.loadingIndicator.appendChild(loadingText);

        container.appendChild(this.loadingIndicator);
      }
      else if (this.loadingIndicator) {
          this.loadingIndicator.remove();
          this.loadingIndicator = null;
          this.loading = false;
      }
    }

    async sendAIMessage(systemMsg=null, skipTools=false) {

      this.messageId = await window.overlayAPI.uuid();
      let message = this.textInput.value.trim();

      // handle new convos
      if (!this.activeConvoId.value && !systemMsg) {
        this.activeConvoId.value = await window.overlayAPI.uuid();
        this.convoTitle = message.substring(0,this.convoTitleLimit);
        await window.overlayAPI.addConversation(this.activeConvoId.value, this.convoTitle);
        this.updateConversationList(this.activeConvoId.value, this.convoTitle);
      }

      this.dialogBox.style.visibility = "visible";

      const convoId = this.activeConvoId.value;

      console.log('convoID', convoId)

      if (!message && ! systemMsg && this.audioInput.files.length === 0 && this.fileInput.files.length === 0) return;

      if (message) this.appendUserPrompt(message);
      await this.setLoading(this.dialogWindow, true)

      this.dialogWindow.scrollTop = this.dialogWindow.scrollHeight;
      this.textInput.value = "";

      if (systemMsg) message = systemMsg;

      // Add user message to the database
      const role = systemMsg ? 'system' : 'user';

      // const formData = new FormData();
      // formData.append("convo_id", convoId);
      // formData.append("history", this.dialogWindow.innerText);
      // formData.append("message", message);

      // if (this.fileInput.files.length) formData.append("file", this.fileInput.files[0]);
      // if (this.audioInput.files.length) formData.append("audio", this.audioInput.files[0]);

      // const response = await fetch("/api/ai-message/", {
      //   method: "POST",
      //   headers: { "X-CSRFToken": this.getCookie?.("csrftoken") },
      //   body: formData,
      // });

      console.log("message", message)


      await this.stream(convoId, message, null, systemMsg); //null is file place holder

      await window.overlayAPI.chat(this.messageId, message, this.history, skipTools);

      // console.log(response);
      // this.history += response.history
      

      // const newConvoId = response.headers.get("X-Convo-ID");
      // const newConvoName = response.headers.get("X-Convo-Name");
      // const msgId = response.headers.get("X-Message-ID");
      // const fileName = response.headers.get("X-File-Name");
      // const audioTranscript = response.headers.get("X-Audio-Trans");

      if (!message && audioTranscript) this.appendUserPrompt(audioTranscript);

      // this.activeConvoId.value = newConvoId || convoId;
      // if (newConvoId && newConvoName) {
      //   
      // }

      this.clearFile();
      this.clearAudio();
    }
  }

  window.__components["ai-chat"] = {
      init(root, props) {
      // store instance on root if you want access later
      root.__aiChat = new AiChat(root, props);
    },
  };
})();