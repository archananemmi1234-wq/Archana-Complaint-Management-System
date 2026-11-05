
// ==================================================
// COMPLAINTCARE - COMPLETE FRONTEND JAVASCRIPT
// USERS + DEPARTMENTS + COMPLAINTS CRUD
// ==================================================

const API = "";

// ==================================================
// API REQUEST
// ==================================================

async function api(url, options = {}) {

    const response = await fetch(API + url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Invalid server response");
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==================================================
// ADMIN LOGIN
// ==================================================

document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("adminLoginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", async event => {

            event.preventDefault();

            const email = document.getElementById("adminEmail").value.trim();

            const password = document.getElementById("adminPassword").value;

            const message = document.getElementById("loginMessage");

            message.textContent = "Checking login...";

            try {

                const result = await api("/api/admin/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password })
                });

                message.textContent = result.message;

                await checkLogin();

            } catch (error) {

                message.textContent = error.message;

            }
        });
    }

    checkLogin();
});

// ==================================================
// CHECK LOGIN
// ==================================================

async function checkLogin() {

    try {

        const data = await api("/api/me");

        const loginPanel = document.getElementById("loginPanel");

        const adminPanel = document.getElementById("adminPanel");

        if (data.role === "admin") {

            loginPanel.classList.add("hidden");

            adminPanel.classList.remove("hidden");

            setupUserControls();

            setupDepartmentControls();

            await loadDashboard();

        } else {

            loginPanel.classList.remove("hidden");

            adminPanel.classList.add("hidden");

        }

    } catch (error) {

        console.error("Login check failed:", error.message);

    }
}

// ==================================================
// DASHBOARD OVERVIEW
// ==================================================

async function loadDashboard() {

    try {

        const [users, departments, complaints] = await Promise.all([

            api("/api/admin/users"),

            api("/api/admin/departments"),

            api("/api/admin/complaints")

        ]);

        document.getElementById("totalUsers").textContent = users.length;

        document.getElementById("totalDepartments").textContent =
            departments.length;

        document.getElementById("totalComplaints").textContent =
            complaints.length;

        const pending = complaints.filter(
            complaint => complaint.status === "Pending"
        );

        document.getElementById("pendingComplaints").textContent =
            pending.length;

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// USERS - AUTOMATIC FORM
// ==================================================

function setupUserControls() {

    const section = document.getElementById("usersSection");

    if (!section || document.getElementById("addUserForm")) return;

    const heading = section.querySelector("h2");

    if (!heading) return;

    const form = document.createElement("form");

    form.id = "addUserForm";

    form.innerHTML = `

        <h3 style="color:#5946a5;margin:20px 0 12px;">
            Add New User
        </h3>

        <div class="crud-form-grid">

            <input type="text"
                id="newUserName"
                placeholder="Enter Name"
                required>

            <input type="email"
                id="newUserEmail"
                placeholder="Enter Email"
                required>

            <input type="text"
                id="newUserPhone"
                placeholder="Enter Phone">

            <input type="password"
                id="newUserPassword"
                placeholder="Enter Password"
                required>

        </div>

        <button type="submit" class="insert-btn">
            + Insert User
        </button>

    `;

    heading.after(form);

    form.addEventListener("submit", insertUser);

    const header = document.querySelector("#usersTable thead tr");

    if (header && !header.querySelector(".user-action-heading")) {

        const th = document.createElement("th");

        th.textContent = "Action";

        th.className = "user-action-heading";

        header.appendChild(th);
    }
}

// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers() {

    try {

        setupUserControls();

        const users = await api("/api/admin/users");

        const tbody = document.querySelector("#usersTable tbody");

        tbody.innerHTML = "";

        if (users.length === 0) {

            tbody.innerHTML = `
                <tr><td colspan="5">No users found</td></tr>
            `;

            return;
        }

        users.forEach(user => {

            const tr = document.createElement("tr");

            const values = [
                user.user_id,
                user.name,
                user.email,
                user.phone || "-"
            ];

            values.forEach(value => {

                const td = document.createElement("td");

                td.textContent = value ?? "";

                tr.appendChild(td);

            });

            const action = document.createElement("td");

            action.innerHTML = `
                <button class="action-btn edit-btn"
                    onclick="editUser(${Number(user.user_id)})">
                    Edit
                </button>

                <button class="action-btn delete-btn"
                    onclick="deleteUser(${Number(user.user_id)})">
                    Delete
                </button>
            `;

            tr.appendChild(action);

            tbody.appendChild(tr);

        });

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// INSERT USER
// ==================================================

async function insertUser(event) {

    event.preventDefault();

    const name = document.getElementById("newUserName").value.trim();

    const email = document.getElementById("newUserEmail").value.trim();

    const phone = document.getElementById("newUserPhone").value.trim();

    const password = document.getElementById("newUserPassword").value;

    try {

        await api("/api/admin/users", {

            method: "POST",

            body: JSON.stringify({
                name,
                email,
                phone,
                password
            })

        });

        document.getElementById("addUserForm").reset();

        showMessage("User inserted successfully!");

        await loadUsers();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// UPDATE USER
// ==================================================

async function editUser(id) {

    try {

        const users = await api("/api/admin/users");

        const user = users.find(item => Number(item.user_id) === Number(id));

        if (!user) {
            showMessage("User not found");
            return;
        }

        const name = prompt("Enter User Name:", user.name);

        if (name === null) return;

        const email = prompt("Enter User Email:", user.email);

        if (email === null) return;

        const phone = prompt("Enter User Phone:", user.phone || "");

        if (phone === null) return;

        if (!name.trim() || !email.trim()) {

            showMessage("Name and Email are required");

            return;
        }

        await api(`/api/admin/users/${id}`, {

            method: "PUT",

            body: JSON.stringify({
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim()
            })

        });

        showMessage("User updated successfully!");

        await loadUsers();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// DELETE USER
// ==================================================

async function deleteUser(id) {

    if (!confirm("Are you sure you want to delete this user?")) {
        return;
    }

    try {

        await api(`/api/admin/users/${id}`, {
            method: "DELETE"
        });

        showMessage("User deleted successfully!");

        await loadUsers();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// DEPARTMENTS - AUTOMATIC FORM
// ==================================================

function setupDepartmentControls() {

    const section = document.getElementById("departmentsSection");

    if (!section || document.getElementById("addDepartmentForm")) return;

    const heading = section.querySelector("h2");

    if (!heading) return;

    const form = document.createElement("form");

    form.id = "addDepartmentForm";

    form.innerHTML = `

        <h3 style="color:#5946a5;margin:20px 0 12px;">
            Add New Department
        </h3>

        <div class="crud-form-grid">

            <input type="text"
                id="newDeptName"
                placeholder="Department Name"
                required>

            <input type="text"
                id="newDeptContact"
                placeholder="Contact Person">

            <input type="email"
                id="newDeptEmail"
                placeholder="Email">

            <input type="text"
                id="newDeptPhone"
                placeholder="Phone">

        </div>

        <button type="submit" class="insert-btn">
            + Insert Department
        </button>

    `;

    heading.after(form);

    form.addEventListener("submit", insertDepartment);

    const header = document.querySelector("#departmentsTable thead tr");

    if (header && !header.querySelector(".dept-action-heading")) {

        const th = document.createElement("th");

        th.textContent = "Action";

        th.className = "dept-action-heading";

        header.appendChild(th);
    }
}

// ==================================================
// LOAD DEPARTMENTS
// ==================================================

async function loadDepartments() {

    try {

        setupDepartmentControls();

        const departments = await api("/api/admin/departments");

        const tbody = document.querySelector("#departmentsTable tbody");

        tbody.innerHTML = "";

        if (departments.length === 0) {

            tbody.innerHTML = `
                <tr><td colspan="6">No departments found</td></tr>
            `;

            return;
        }

        departments.forEach(dept => {

            const tr = document.createElement("tr");

            const values = [
                dept.department_id,
                dept.department_name,
                dept.contact_person || "-",
                dept.email || "-",
                dept.phone || "-"
            ];

            values.forEach(value => {

                const td = document.createElement("td");

                td.textContent = value ?? "";

                tr.appendChild(td);

            });

            const action = document.createElement("td");

            action.innerHTML = `
                <button class="action-btn edit-btn"
                    onclick="editDepartment(${Number(dept.department_id)})">
                    Edit
                </button>

                <button class="action-btn delete-btn"
                    onclick="deleteDepartment(${Number(dept.department_id)})">
                    Delete
                </button>
            `;

            tr.appendChild(action);

            tbody.appendChild(tr);

        });

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// INSERT DEPARTMENT
// ==================================================

async function insertDepartment(event) {

    event.preventDefault();

    const department_name =
        document.getElementById("newDeptName").value.trim();

    const contact_person =
        document.getElementById("newDeptContact").value.trim();

    const email =
        document.getElementById("newDeptEmail").value.trim();

    const phone =
        document.getElementById("newDeptPhone").value.trim();

    try {

        await api("/api/admin/departments", {

            method: "POST",

            body: JSON.stringify({
                department_name,
                contact_person,
                email,
                phone
            })

        });

        document.getElementById("addDepartmentForm").reset();

        showMessage("Department inserted successfully!");

        await loadDepartments();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// UPDATE DEPARTMENT
// ==================================================

async function editDepartment(id) {

    try {

        const departments = await api("/api/admin/departments");

        const dept = departments.find(
            item => Number(item.department_id) === Number(id)
        );

        if (!dept) {
            showMessage("Department not found");
            return;
        }

        const department_name = prompt(
            "Department Name:",
            dept.department_name
        );

        if (department_name === null) return;

        const contact_person = prompt(
            "Contact Person:",
            dept.contact_person || ""
        );

        if (contact_person === null) return;

        const email = prompt(
            "Email:",
            dept.email || ""
        );

        if (email === null) return;

        const phone = prompt(
            "Phone:",
            dept.phone || ""
        );

        if (phone === null) return;

        if (!department_name.trim()) {

            showMessage("Department name is required");

            return;
        }

        await api(`/api/admin/departments/${id}`, {

            method: "PUT",

            body: JSON.stringify({
                department_name: department_name.trim(),
                contact_person: contact_person.trim(),
                email: email.trim(),
                phone: phone.trim()
            })

        });

        showMessage("Department updated successfully!");

        await loadDepartments();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// DELETE DEPARTMENT
// ==================================================

async function deleteDepartment(id) {

    if (!confirm("Are you sure you want to delete this department?")) {
        return;
    }

    try {

        await api(`/api/admin/departments/${id}`, {
            method: "DELETE"
        });

        showMessage("Department deleted successfully!");

        await loadDepartments();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// LOAD COMPLAINTS
// ==================================================

async function loadComplaints() {

    try {

        const complaints = await api("/api/admin/complaints");

        const tbody = document.querySelector("#complaintsTable tbody");

        tbody.innerHTML = "";

        if (complaints.length === 0) {

            tbody.innerHTML = `
                <tr><td colspan="7">No complaints found</td></tr>
            `;

            return;
        }

        complaints.forEach(complaint => {

            const status = [
                "Pending",
                "In Progress",
                "Resolved"
            ].includes(complaint.status)
                ? complaint.status
                : "Pending";

            tbody.innerHTML += `

                <tr>

                    <td>${complaint.complaint_id}</td>

                    <td>${escapeHTML(complaint.name || "-")}</td>

                    <td>${escapeHTML(complaint.subject)}</td>

                    <td>${escapeHTML(complaint.department_name || "-")}</td>

                    <td>${escapeHTML(complaint.category)}</td>

                    <td>

                        <select id="status-${complaint.complaint_id}">

                            <option value="Pending"
                                ${status === "Pending" ? "selected" : ""}>
                                Pending
                            </option>

                            <option value="In Progress"
                                ${status === "In Progress" ? "selected" : ""}>
                                In Progress
                            </option>

                            <option value="Resolved"
                                ${status === "Resolved" ? "selected" : ""}>
                                Resolved
                            </option>

                        </select>

                    </td>

                    <td>

                        <button class="action-btn"
                            onclick="updateComplaint(${complaint.complaint_id})">
                            Update
                        </button>

                        <button class="action-btn delete-btn"
                            onclick="deleteComplaint(${complaint.complaint_id})">
                            Delete
                        </button>

                    </td>

                </tr>

            `;
        });

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// UPDATE COMPLAINT
// ==================================================

async function updateComplaint(id) {

    try {

        const status = document.getElementById(`status-${id}`).value;

        await api(`/api/admin/complaints/${id}`, {

            method: "PATCH",

            body: JSON.stringify({ status })

        });

        showMessage("Complaint status updated successfully!");

        await loadComplaints();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// DELETE COMPLAINT
// ==================================================

async function deleteComplaint(id) {

    if (!confirm("Are you sure you want to delete this complaint?")) {
        return;
    }

    try {

        await api(`/api/admin/complaints/${id}`, {
            method: "DELETE"
        });

        showMessage("Complaint deleted successfully!");

        await loadComplaints();

        await loadDashboard();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// SIDEBAR DROPDOWN
// ==================================================

function toggleDropdown(id, button) {

    const dropdown = document.getElementById(id);

    if (!dropdown) return;

    const isOpen = dropdown.classList.toggle("show");

    const arrow = button?.querySelector(".arrow");

    if (arrow) {
        arrow.textContent = isOpen ? "▲" : "▼";
    }
}

// ==================================================
// SHOW SECTION
// ==================================================

function showSection(sectionId, button) {

    document.querySelectorAll(".main .section").forEach(section => {
        section.classList.add("hidden");
    });

    const selectedSection = document.getElementById(sectionId);

    if (selectedSection) {
        selectedSection.classList.remove("hidden");
    }

    if (sectionId === "usersSection") {
        loadUsers();
    }

    if (sectionId === "departmentsSection") {
        loadDepartments();
    }

    if (sectionId === "complaintsSection") {
        loadComplaints();
    }

    document.querySelectorAll(".sidebar button").forEach(btn => {
        btn.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
    }
}

// ==================================================
// SEARCH TABLE
// ==================================================

function filterTable(tableId, searchValue) {

    const rows = document.querySelectorAll(`#${tableId} tbody tr`);

    const search = searchValue.toLowerCase();

    rows.forEach(row => {

        row.style.display =
            row.textContent.toLowerCase().includes(search) ? "" : "none";

    });
}

// ==================================================
// REFRESH DASHBOARD
// ==================================================

async function refreshDashboard() {

    await loadDashboard();

    const usersSection = document.getElementById("usersSection");

    const departmentsSection =
        document.getElementById("departmentsSection");

    const complaintsSection =
        document.getElementById("complaintsSection");

    if (!usersSection.classList.contains("hidden")) {
        await loadUsers();
    }

    if (!departmentsSection.classList.contains("hidden")) {
        await loadDepartments();
    }

    if (!complaintsSection.classList.contains("hidden")) {
        await loadComplaints();
    }

    showMessage("Dashboard refreshed successfully!");
}

// ==================================================
// ADMIN LOGOUT
// ==================================================

async function logout() {

    if (!confirm("Are you sure you want to logout?")) return;

    try {

        await api("/api/logout", {
            method: "POST"
        });

        location.reload();

    } catch (error) {

        showMessage(error.message);

    }
}

// ==================================================
// SHOW MESSAGE
// ==================================================

function showMessage(message) {

    const element = document.getElementById("dashboardMessage");

    if (!element) return;

    element.textContent = message;

    setTimeout(() => {
        element.textContent = "";
    }, 4000);
}

// ==================================================
// END OF COMPLAINTCARE JAVASCRIPT
// ==================================================
