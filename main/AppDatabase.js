
const fs = require("fs");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");

class AppDatabase {
    constructor() {
        this.DB_PATH = null;
        this.db = null;

        this.stmtGetConversations = null;
        this.stmtAddConversation = null;
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
    }

    prepareStatements() {
        this.stmtGetConversations = this.db.prepare(`SELECT * FROM Conversation ORDER BY created_at DESC`);
        this.stmtAddConversation = this.db.prepare(`INSERT INTO Conversation (id, title) VALUES (?, ?)`);
    }

    async getConversations() {
        return this.stmtGetConversations.all();
    }

    async addConversation(id, title) {
        console.log(id, title)
        const info = this.stmtAddConversation.run(id, title); // binds params
        return info;
    }
}

module.exports = { AppDatabase }