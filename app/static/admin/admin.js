/**
 * Admin Portal - Vanilla JS Core
 * Handles Auth, Routing, Data Fetching and DOM Rendering
 */

const state = {
    token: localStorage.getItem('admin_token'),
    currentView: 'dashboard',
    users: [],
    logs: [],
    metrics: null
};

// --- API Service ---
const api = {
    async request(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
        
        try {
            const response = await fetch(`/api${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            });

            if (response.status === 401 || response.status === 403) {
                this.logout();
                return null;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Request failed');
            }

            return await response.json();
        } catch (err) {
            console.error(`API Error [${endpoint}]:`, err);
            throw err;
        }
    },

    login(credentials) { return this.request('/auth/login', 'POST', credentials); },
    getMetrics() { return this.request('/admin/metrics/dashboard'); },
    getUsers() { return this.request('/admin/users'); },
    banUser(id, reason) { return this.request(`/admin/users/${id}/ban`, 'POST', { reason }); },
    getLogs() { return this.request('/admin/system/logs'); },
    getEmails() { return this.request('/admin/emails'); },
    getFeedbacks() { return this.request('/admin/feedbacks'); },
    replyToFeedback(id, message) { return this.request(`/admin/feedbacks/${id}/reply`, 'POST', { message }); },
    
    logout() {
        localStorage.removeItem('admin_token');
        state.token = null;
        showView('login');
    }
};

// --- View Router ---
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    if (!state.token && viewName !== 'login') {
        document.getElementById('login-view').classList.remove('hidden');
        lucide.createIcons();
        return;
    }

    if (viewName === 'login') {
        document.getElementById('login-view').classList.remove('hidden');
    } else {
        document.getElementById('portal-view').classList.remove('hidden');
        renderSection(viewName);
    }
    
    lucide.createIcons();
}

function renderSection(section) {
    state.currentView = section;
    
    // Update Sidebar UI
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === section);
    });

    // Update Content Visibility
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${section}-content`).classList.remove('hidden');
    
    document.getElementById('page-title').innerText = section.charAt(0).toUpperCase() + section.slice(1);

    // Trigger data fetch
    if (section === 'dashboard') loadDashboard();
    if (section === 'users') loadUsers();
    if (section === 'logs') loadLogs();
    if (section === 'emails') loadEmails();
    if (section === 'feedback') loadFeedbacks();
}

// --- Dashboard Logic ---
async function loadDashboard() {
    try {
        const metrics = await api.getMetrics();
        if (!metrics) return;
        
        const grid = document.getElementById('metrics-grid');
        const cards = [
            { label: 'Total Users', value: metrics.total_users, icon: 'users', color: 'bg-indigo-500' },
            { label: 'Emails Sent', value: metrics.total_emails_sent || 0, icon: 'mail', color: 'bg-emerald-500' },
            { label: 'Failed Mails', value: metrics.failed_emails || 0, icon: 'alert-circle', color: 'bg-rose-500' },
            { label: 'Total Apps', value: metrics.total_applications, icon: 'briefcase', color: 'bg-amber-500' },
            { label: 'AI Operations', value: metrics.ai_operations || 0, icon: 'cpu', color: 'bg-purple-500' }
        ];

        grid.innerHTML = cards.map(c => `
            <div class="card glass metric-card">
                <div class="metric-header">
                    <div class="metric-icon ${c.color}">
                        <i data-lucide="${c.icon}"></i>
                    </div>
                </div>
                <h4>${c.label}</h4>
                <div class="value">${c.value.toLocaleString()}</div>
            </div>
        `).join('');

        // Render mock chart
        const chart = document.getElementById('traffic-bars');
        chart.innerHTML = Array.from({length: 12}, () => Math.floor(Math.random() * 80) + 20)
            .map(h => `<div class="bar" style="height: ${h}%"></div>`).join('');

        lucide.createIcons();
    } catch (err) {
        console.error("Dashboard failed", err);
    }
}

// --- Users Logic ---
async function loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading user records...</td></tr>';
    
    try {
        state.users = await api.getUsers();
        renderUserTable(state.users);
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-red-400">Error loading users.</td></tr>';
    }
}

function renderUserTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${user.email[0].toUpperCase()}</div>
                    <div>
                        <div class="font-medium">${user.full_name || 'Anonymous'}</div>
                        <div style="font-size: 12px; color: var(--text-secondary)">${user.email}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">
                    ${(user.role || 'user').toUpperCase()}
                </span>
            </td>
            <td>
                <div class="flex items-center">
                    <div class="status-dot ${user.is_banned ? 'bg-error' : 'bg-success'}"></div>
                    <span style="font-size: 13px">${user.is_banned ? 'Banned' : 'Active'}</span>
                </div>
            </td>
            <td class="text-right">
                <div class="actions-cell">
                    <button class="btn-icon ${user.is_banned ? 'unban' : 'ban'}" onclick="toggleBan('${user.id}', ${user.is_banned})">
                        <i data-lucide="${user.is_banned ? 'check-circle' : 'ban'}"></i>
                    </button>
                    <button class="btn-icon"><i data-lucide="external-link"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

// --- Logs Logic ---
async function loadLogs() {
    const stream = document.getElementById('logs-stream');
    stream.innerHTML = '<p class="p-8 text-center text-secondary">Synchronizing events...</p>';
    
    try {
        const logs = await api.getLogs();
        stream.innerHTML = logs.map(log => `
            <div class="log-item">
                <div class="log-icon">
                    <i data-lucide="${log.action.includes('ban') ? 'alert-triangle' : 'shield'}" class="${log.action.includes('ban') ? 'text-error' : 'text-success'}"></i>
                </div>
                <div class="log-content">
                    <h5>${log.action.toUpperCase()} <span style="font-weight: 400; color: var(--text-secondary)">by Admin</span></h5>
                    <p>Target ID: <span style="font-family: monospace">${log.entity_id || 'SYSTEM'}</span></p>
                    <div class="log-time">${new Date(log.timestamp).toLocaleString()}</div>
                    ${log.metadata ? `<pre class="log-meta">${JSON.stringify(log.metadata)}</pre>` : ''}
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (err) {
        stream.innerHTML = '<p class="p-8 text-center text-error">Stream disconnected.</p>';
    }
}

// --- Emails Logic ---
async function loadEmails() {
    const tableBody = document.getElementById('emails-table-body');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Fetching communication trail...</td></tr>';
    
    try {
        const logs = await api.getEmails();
        tableBody.innerHTML = logs.map(log => `
            <tr>
                <td>
                    <div class="flex items-center gap-3">
                        <div class="metric-icon bg-white/5" style="width: 32px; height:32px">
                            <i data-lucide="mail" style="width: 14px"></i>
                        </div>
                        <span class="font-medium">${log.recipient}</span>
                    </div>
                </td>
                <td><span class="text-secondary">${log.subject}</span></td>
                <td>
                    <div class="flex items-center">
                        <div class="status-dot ${log.status === 'success' ? 'bg-success' : 'bg-error'}"></div>
                        <span style="font-size: 13px">${log.status === 'success' ? 'Delivered' : 'Failed'}</span>
                    </div>
                </td>
                <td><span class="log-time">${new Date(log.timestamp).toLocaleString()}</span></td>
            </tr>
        `).join('');
        lucide.createIcons();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-error">Communication trail blocked.</td></tr>';
    }
}

// --- Feedback Logic ---
async function loadFeedbacks() {
    const list = document.getElementById('feedback-list');
    list.innerHTML = '<p class="p-8 text-secondary">Gathering user reports...</p>';
    
    try {
        const feedbacks = await api.getFeedbacks();
        if (feedbacks.length === 0) {
            list.innerHTML = '<div class="p-20 text-center glass"><p class="text-secondary">No user reports found.</p></div>';
            return;
        }
        
        list.className = 'feedback-grid';
        list.innerHTML = feedbacks.map(f => `
            <div class="card glass feedback-card ${f.status === 'replied' ? 'replied' : ''}">
                <div class="feedback-header">
                    <div class="user-info">
                        <div class="user-avatar">${f.user_email[0].toUpperCase()}</div>
                        <div>
                            <div class="font-medium">${f.user_name}</div>
                            <div class="text-xs text-secondary">${f.user_email}</div>
                        </div>
                    </div>
                    <span class="badge ${f.status === 'new' ? 'badge-admin' : 'badge-user'}">
                        ${f.status.toUpperCase()}
                    </span>
                </div>
                <div class="feedback-body">
                    <p class="summary">${f.summary}</p>
                    <div class="full-message">${f.message}</div>
                </div>
                <div class="feedback-footer">
                    <div class="log-time">${new Date(f.created_at).toLocaleString()}</div>
                    ${f.status === 'new' ? `
                        <button class="btn-primary btn-sm" onclick="openReplyModal('${f.id}', '${f.user_email}')">
                            <i data-lucide="reply"></i> Reply
                        </button>
                    ` : `
                        <div class="replied-notice">
                            <i data-lucide="check-circle"></i> Replied
                        </div>
                    `}
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (err) {
        list.innerHTML = '<p class="p-8 text-error">Failed to load feedback list.</p>';
    }
}

window.openReplyModal = (feedbackId, userEmail) => {
    const modal = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');

    title.innerText = `Reply to ${userEmail}`;
    body.innerHTML = `
        <p class="mb-4">Enter your official response below. The user will receive this as an official Smart Apply support email.</p>
        <textarea id="reply-text" rows="5" placeholder="Dear user, thank you for your feedback..."></textarea>
    `;

    confirmBtn.innerText = 'Send Response';
    confirmBtn.onclick = async () => {
        const message = document.getElementById('reply-text').value;
        if (!message) return alert("Please enter a message");
        
        try {
            confirmBtn.disabled = true;
            confirmBtn.innerText = 'Sending...';
            await api.replyToFeedback(feedbackId, message);
            modal.classList.add('hidden');
            loadFeedbacks();
        } catch (err) {
            alert("Failed to send reply: " + err.message);
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Send Response';
        }
    };

    cancelBtn.onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
};

// --- Interaction Handlers ---
window.toggleBan = (userId, currentStatus) => {
    const action = currentStatus ? 'unban' : 'ban';
    const reason = prompt(`Enter reason for ${action}:`);
    if (reason === null) return;

    api.banUser(userId, reason)
        .then(() => {
            renderSection(state.currentView);
        })
        .catch(err => alert("Operation failed: " + err.message));
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Handle Login Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            errorEl.classList.add('hidden');
            const data = await api.login({ email, password });
            if (data) {
                state.token = data.access_token;
                localStorage.setItem('admin_token', state.token);
                showView('dashboard');
            }
        } catch (err) {
            errorEl.innerText = err.message || "Unauthorized access";
            errorEl.classList.remove('hidden');
        }
    });

    // Handle Logout
    document.getElementById('logout-btn').addEventListener('click', () => api.logout());

    // Handle Navigation clicks
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            window.location.hash = view;
            renderSection(view);
        });
    });

    // Handle Hash Change
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1) || 'dashboard';
        if (state.token) renderSection(hash);
    });

    // Initial Load
    const initialView = window.location.hash.slice(1) || 'dashboard';
    showView(state.token ? initialView : 'login');
});
