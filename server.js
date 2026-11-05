
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3001;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MYSQL SESSION STORE
const sessionStore = new MySQLStore({
    host: "localhost",
    user: "root",
    password: "root",
    database: "online_complaint"
});

app.use(session({
    key: "complaint_session",
    secret: "complaintcare_secret_key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

// STATIC FILES
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// AUTHENTICATION
// ==========================================

function userOnly(req, res, next) {
    if (req.session.user) return next();

    return res.status(401).json({
        message: "Please login first"
    });
}

function adminOnly(req, res, next) {
    if (req.session.admin) return next();

    return res.status(401).json({
        message: "Please login first"
    });
}

// ==========================================
// ADMIN ACCOUNT
// ==========================================

async function initializeAdmin() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS admins (
            admin_id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        )
    `);

    const hashedPassword = await bcrypt.hash("Admin@12345", 10);

    await db.query(`
        INSERT INTO admins (email, password)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE password = VALUES(password)
    `, ["admin@college.com", hashedPassword]);

    console.log("Admin Account Ready!");
}

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==========================================
// CHECK LOGIN
// ==========================================

app.get("/api/me", (req, res) => {
    if (req.session.admin) {
        return res.json({
            role: "admin",
            email: req.session.admin.email
        });
    }

    if (req.session.user) {
        return res.json({
            role: "user",
            user: req.session.user
        });
    }

    res.json({ role: "guest" });
});

// ==========================================
// ADMIN LOGIN
// ==========================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid admin credentials"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            rows[0].password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid admin credentials"
            });
        }

        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({
                    message: "Session error"
                });
            }

            req.session.admin = {
                id: rows[0].admin_id,
                email: rows[0].email
            };

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({
                        message: "Session save failed"
                    });
                }

                res.json({
                    success: true,
                    message: "Admin login successful"
                });
            });
        });

    } catch (error) {
        console.error("Admin Login Error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

// ==========================================
// USER REGISTER
// ==========================================

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Please fill all required fields"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users (name, email, password, phone)
             VALUES (?, ?, ?, ?)`,
            [
                name.trim(),
                email.trim(),
                hashedPassword,
                phone || null
            ]
        );

        res.json({
            success: true,
            message: "Registration successful"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Registration failed. Email may already exist."
        });
    }
});

// ==========================================
// USER LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (!rows.length) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const valid = await bcrypt.compare(
            password,
            rows[0].password
        );

        if (!valid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        req.session.user = {
            user_id: rows[0].user_id,
            name: rows[0].name,
            email: rows[0].email
        };

        res.json({
            success: true,
            message: "Login successful"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

// ==========================================
// ADD COMPLAINT
// ==========================================

app.post("/api/complaints", userOnly, async (req, res) => {
    try {
        const {
            department_id,
            subject,
            description,
            category
        } = req.body;

        await db.query(
            `INSERT INTO complaints
            (user_id, department_id, subject, description,
             category, complaint_date, status)
            VALUES (?, ?, ?, ?, ?, NOW(), 'Pending')`,
            [
                req.session.user.user_id,
                department_id,
                subject,
                description,
                category
            ]
        );

        res.json({
            success: true,
            message: "Complaint submitted successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Complaint submission failed"
        });
    }
});

// ==========================================
// USER COMPLAINTS
// ==========================================

app.get("/api/my-complaints", userOnly, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT c.*, d.department_name
             FROM complaints c
             LEFT JOIN departments d
             ON c.department_id = d.department_id
             WHERE c.user_id = ?
             ORDER BY c.complaint_id DESC`,
            [req.session.user.user_id]
        );

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to fetch complaints"
        });
    }
});

// ==========================================
// ADMIN: VIEW ALL USERS
// ==========================================

app.get("/api/admin/users", adminOnly, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT user_id, name, email, phone
             FROM users
             ORDER BY user_id DESC`
        );

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to fetch users"
        });
    }
});

// ==========================================
// ADMIN: INSERT USER
// ==========================================

app.post("/api/admin/users", adminOnly, async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users
             (name, email, password, phone)
             VALUES (?, ?, ?, ?)`,
            [
                name.trim(),
                email.trim(),
                hashedPassword,
                phone || null
            ]
        );

        res.json({
            success: true,
            message: "User inserted successfully"
        });

    } catch (error) {
        console.error("Insert User Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This email already exists"
            });
        }

        res.status(500).json({
            message: "Unable to insert user"
        });
    }
});

// ==========================================
// ADMIN: UPDATE USER
// ==========================================

app.put("/api/admin/users/:id", adminOnly, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        if (!name || !email) {
            return res.status(400).json({
                message: "Name and email are required"
            });
        }

        const [result] = await db.query(
            `UPDATE users
             SET name = ?, email = ?, phone = ?
             WHERE user_id = ?`,
            [
                name.trim(),
                email.trim(),
                phone || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "User updated successfully"
        });

    } catch (error) {
        console.error("Update User Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This email already exists"
            });
        }

        res.status(500).json({
            message: "Unable to update user"
        });
    }
});

// ==========================================
// ADMIN: DELETE USER
// ==========================================

app.delete("/api/admin/users/:id", adminOnly, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        // Check whether user has complaints
        const [complaints] = await db.query(
            "SELECT COUNT(*) AS total FROM complaints WHERE user_id = ?",
            [id]
        );

        if (complaints[0].total > 0) {
            return res.status(409).json({
                message: "This user has complaints. Delete or reassign those complaints before deleting this user."
            });
        }

        const [result] = await db.query(
            "DELETE FROM users WHERE user_id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error("Delete User Error:", error);

        res.status(500).json({
            message: "Unable to delete user"
        });
    }
});

// ==========================================
// ADMIN: ALL DEPARTMENTS
// ==========================================

app.get("/api/admin/departments", adminOnly, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT department_id, department_name,
                    contact_person, email, phone
             FROM departments`
        );

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to fetch departments"
        });
    }
});

// ==========================================
// ADMIN: ALL COMPLAINTS
// ==========================================

app.get("/api/admin/complaints", adminOnly, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                c.complaint_id,
                c.user_id,
                u.name AS name,
                c.subject,
                c.description,
                d.department_name,
                c.category,
                c.status,
                c.complaint_date
            FROM complaints c
            LEFT JOIN users u
                ON c.user_id = u.user_id
            LEFT JOIN departments d
                ON c.department_id = d.department_id
            ORDER BY c.complaint_id DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to fetch complaints"
        });
    }
});

// ==========================================
// ADMIN: UPDATE COMPLAINT STATUS
// ==========================================

app.patch("/api/admin/complaints/:id", adminOnly, async (req, res) => {
    try {
        const { status } = req.body;

        const allowed = [
            "Pending",
            "In Progress",
            "Resolved",
            "Rejected"
        ];

        if (!allowed.includes(status)) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        await db.query(
            `UPDATE complaints
             SET status = ?
             WHERE complaint_id = ?`,
            [status, req.params.id]
        );

        res.json({
            success: true,
            message: "Status updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Status update failed"
        });
    }
});

// ==========================================
// ADMIN: DELETE COMPLAINT
// ==========================================

app.delete("/api/admin/complaints/:id", adminOnly, async (req, res) => {
    try {
        await db.query(
            "DELETE FROM complaints WHERE complaint_id = ?",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Complaint deleted successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Delete failed"
        });
    }
});

// ==========================================
// LOGOUT
// ==========================================

app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: "Logout failed"
            });
        }

        res.clearCookie("complaint_session");

        res.json({
            success: true,
            message: "Logged out successfully"
        });
    });
});

// ==========================================
// START SERVER
// ==========================================

async function startServer() {
    try {
        await db.query("SELECT 1");

        await initializeAdmin();

        app.listen(PORT, () => {
            console.log("--------------------------------");
            console.log("ComplaintCare Server Started!");
            console.log("Website: http://localhost:3001");
            console.log("Admin Email: admin@college.com");
            console.log("Admin Password: Admin@12345");
            console.log("--------------------------------");
        });

    } catch (error) {
        console.error("Server Startup Error:", error);
    }
}

startServer();
