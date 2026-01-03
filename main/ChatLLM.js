const http = require("http");

async function chatWithLLM(message, history, onChunk) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const body = JSON.stringify({
      model: 'gemma:2b',
      stream: true,
      messages: [
        {
          role: "system",
          content: "[ Instructions ] You are a helpful assistant. Utilize markdown when appropriate and stay on topic."
        },
        ...history, 
        { role: "user", content: message }]
    });

    req.write(body);
    req.end();

    let buffer = "";

    req.on("response", (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");

        buffer = lines.pop(); // save incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || "";

            if (content && typeof onChunk === "function") {
              onChunk(content);
            }
          } catch (err) {
            console.error("Stream parse error:", err);
          }
        }
      });

      res.on("end", () => {
        resolve();
      });
    });

    req.on("error", (err) => reject(err));
  });
}

module.exports = { chatWithLLM };