
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root", 
    database: "online_complaint",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    try {
        const connection = await db.getConnection();

        console.log("MySQL Database Connected Successfully!");

        connection.release();

    } catch (error) {
        console.log("Database Connection Failed:", error.message);
    }
}

testConnection();

module.exports = db;
