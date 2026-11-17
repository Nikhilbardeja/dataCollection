const API = '/admin';
const form = document.getElementById('loginForm');
const button = document.getElementById('submit');
const error = document.getElementById('error');
if (new URLSearchParams(location.search).get('reason') === 'expired') document.getElementById('sessionMessage').hidden = false;
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
        const response = await fetch(API + '/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (response.status === 401) {
            error.textContent = 'Incorrect email or password. Please try again.';
            return;
        }
        let body = {};
        try {
            body = await response.json();
        } catch { }
        if (!response.ok) {
            error.textContent = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : 'Unable to sign in. Please try again.';
            return;
        }
        document.getElementById('password').value = '';
        location.replace(API + '/');
    } catch {
        error.textContent = 'Cannot reach the server. Please check your connection and try again.';
    }
    finally {
        button.disabled = false;
        button.innerHTML = 'Sign in <span>→</span>';
    }
});
