
const fs = require("fs");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");

class AppDatabase {
    constructor() {
        this.DB_PATH = null;
        this.db = null;

        // Conversations
        this.stmtGetConversations = null;
        this.stmtAddConversation = null;

        // Messages
        this.stmtGetMessages = null;
        this.stmtAddMessage = null;
    }

    async init() {
        this.DB_PATH = await this.getDefaultDbPath();
        await this.ensureDirForFile(this.DB_PATH)
        this.db = new Database(this.DB_PATH);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.createTables();
        this.prepareStatements()
        console.log("Database initialized at:", this.DB_PATH);
        return this.db;
    }

    async getDefaultDbPath() {
        if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);

        // Cross-platform-ish "user data" folder (similar to Electron app.getPath("userData"))
        // In your actual Electron main process, prefer:
        //   path.join(app.getPath("userData"), "app.db")
        const appName = process.env.APP_NAME || "agent-overlay";
        const platform = process.platform;

        let baseDir;
        if (platform === "darwin") {
            baseDir = path.join(os.homedir(), "Library", "Application Support", appName);
        } else if (platform === "win32") {
            baseDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appName);
        } else {
            baseDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), appName);
        }

        return path.join(baseDir, "app.db");
    }

    async ensureDirForFile(filePath) {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
    }

    async createTables() {
        // Create Conversation table
        this.db.exec(
            `CREATE TABLE IF NOT EXISTS Conversation (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );`
        );

        this.db.exec(
            `
            CREATE TABLE IF NOT EXISTS Message (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            message TEXT, 
            ai_response TEXT,
            file TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),

            FOREIGN KEY (conversation_id) REFERENCES Conversation(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_message_conversation_id_created
            ON Message(conversation_id, created_at);
            `
        )
    }

    prepareStatements() {
        // Conversations
        this.stmtGetConversations = this.db.prepare(`SELECT * FROM Conversation ORDER BY created_at ASC`);
        this.stmtAddConversation = this.db.prepare(`INSERT INTO Conversation (id, title) VALUES (?, ?)`);
        
        // Messages
        this.stmtGetMessages = this.db.prepare(`SELECT * FROM Message WHERE conversation_id = ? ORDER BY created_at ASC`)
        this.stmtAddMessage = this.db.prepare(`INSERT INTO Message (id, conversation_id, message, ai_response, file) VALUES (?, ?, ?, ?, ?)`)
    }

    // Conversations
    async getConversations() {
        return this.stmtGetConversations.all();
    }

    async addConversation(id, title) {
        console.log(id, title)
        const info = this.stmtAddConversation.run(id, title); // binds params
        return info;
    }

    // Messages 
    async getMessages(conversation_id) {
        return this.stmtGetMessages.all(conversation_id);
    }

    async addMessage(id, conversation_id, message, ai_response, file) {
        return this.stmtAddMessage.run(id, conversation_id, message, ai_response, file);
    }
}

module.exports = { AppDatabase }