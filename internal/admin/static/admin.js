// Admin requests follow the routes and request bodies in internal/admin/router.go.
const API = '/admin';
const list = document.getElementById('documentList');
const detail = document.getElementById('detail');
const modal = document.getElementById('modal');
let documents = [], selected = null, opener = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function request(url, method = 'GET', payload) {
  let response;
  try {
    response = await fetch(url, { method, credentials: 'same-origin', headers: payload === undefined ? {} : { 'Content-Type': 'application/json' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  }
  catch {
    throw new Error('Unable to reach the server. Please try again.');
  }
  if (response.status === 401) {
    window.location.replace(API + '/login');
    throw new Error('Your admin session has expired. Redirecting to login.');
  }
  let body = {};
  try {
    body = await response.json();
  } catch { }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : `Request failed (${response.status}). Please try again.`);
  return body;
}
async function loadDocuments(preferred = selected) {
  list.innerHTML = '<div class="empty">Loading document types…</div>';
  try {
    const response = await request(API + '/document-types');
    if (!Array.isArray(response.documents)) throw new Error('The server returned an invalid document list.');
    documents = response.documents;
    selected = documents.some(d => d.documentId === preferred) ? preferred : (documents[0]?.documentId || null);
    render();
  } catch (error) {
    documents = [];
    selected = null;
    document.getElementById('count').textContent = '— DOCUMENTS';
    list.innerHTML = `<div class="card empty"><b>Unable to load documents</b><p>${esc(error.message)}</p><button class="outline small-btn" id="retry">Try again</button></div>`;
    detail.innerHTML = '<div class="empty"><div class="empty-icon">▤</div><b>Documents unavailable</b><p>Connect the admin API to manage your configuration.</p></div>';
    document.getElementById('retry').onclick = () => loadDocuments();
  }
}
function render() {
  document.getElementById('count').textContent = `${documents.length} ${documents.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'}`;
  list.innerHTML = documents.length ? documents.map(d => `<button class="doc-item ${d.documentId === selected ? 'active' : ''}" data-document="${esc(d.documentId)}"><span class="doc-icon">▤</span><span><b>${esc(d.name)}</b><small>${(d.fields || []).length} fields · ${d.required ? 'Required' : 'Optional'} · ${d.active ? 'Active' : 'Inactive'}</small></span><span class="chevron">›</span></button>`).join('') : '<div class="card empty"><b>No document types yet</b><p>Add your first document to get started.</p></div>';
  list.querySelectorAll('[data-document]').forEach(button => button.onclick = () => {
    selected = button.dataset.document;
    render()
  });
  const doc = documents.find(d => d.documentId === selected);
  if (!doc) {
    detail.innerHTML = '<div class="empty"><div class="empty-icon">▤</div><b>Select a document</b><p>Its fields and settings will appear here.</p></div>';
    return;
  }
  detail.innerHTML = `<div class="detail-top"><div class="detail-title"><div class="doc-icon">▤</div><div><h3>${esc(doc.name)}</h3><p>ID: ${esc(doc.documentId)} &nbsp;
<span class="badge ${doc.required ? '' : 'optional'}">${doc.required ? 'Required' : 'Optional'}</span> &nbsp;
<span class="badge ${doc.active ? '' : 'optional'}">${doc.active ? 'Active' : 'Inactive'}</span></p></div></div><div class="actions"><button class="outline small-btn" id="editDocument">Edit document</button></div></div><div class="separator"></div><div class="fields-heading"><div><h4>Fields</h4><p>Details collected for this document.</p></div><button class="outline small-btn" id="addField">＋ &nbsp;
Add field</button></div><div class="field-list">${(doc.fields || []).length ? doc.fields.map(f => `<div class="field-row"><div class="field-ico">${f.type === 'date' ? '▦' : 'Aa'}</div><div class="field-copy"><b>${esc(f.label)}</b><p>${esc(f.key)} · ${esc(f.type)} · ${f.required ? 'Required' : 'Optional'}${f.pattern ? ' · Pattern set' : ''}${f.not_future ? ' · No future dates' : ''} · ${f.active ? 'Active' : 'Inactive'}</p></div><div class="field-actions"><button class="icon-btn" data-edit-field="${esc(f.key)}" aria-label="Edit ${esc(f.label)}">Edit</button></div></div>`).join('') : '<div class="empty">No fields yet. Add a field to start collecting details.</div>'}</div>`;
  document.getElementById('editDocument').onclick = () => documentForm(doc);
  document.getElementById('addField').onclick = () => fieldForm(doc);
  detail.querySelectorAll('[data-edit-field]').forEach(b => b.onclick = () => fieldForm(doc, doc.fields.find(f => f.key === b.dataset.editField)));
}
function openModal(title, body, kicker = 'DOCUMENT SETTINGS') {
  opener = document.activeElement;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalKicker').textContent = kicker;
  document.getElementById('modalBody').innerHTML = body;
  modal.hidden = false;
  modal.querySelector('input:not([disabled]),select,button')?.focus();
}
function closeModal() {
  modal.hidden = true;
  document.getElementById('modalBody').innerHTML = '';
  if (opener?.isConnected) opener.focus();
}
document.getElementById('closeModal').onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal() };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal() });
function errorInModal(message) {
  document.getElementById('modalError').textContent = message;
}
function showSaveNotice(result) {
  const box = document.getElementById('saveNotice');
  box.hidden = false;
  box.textContent = result.cache_refreshed === false ? (result.message || 'Saved, but the updated settings may not appear immediately.') : (result.message || 'Changes saved.');
  box.className = result.cache_refreshed === false ? 'save-notice warning-notice' : 'save-notice';
}
function documentForm(doc = null) {
  openModal(doc ? 'Edit document' : 'Add a document', `<form id="editor"><div class="form-grid"><div class="form-field"><label for="id">Document ID</label><input id="id" required pattern="[a-z][a-z0-9_-]*" maxlength="50" value="${esc(doc?.documentId || '')}" placeholder="e.g. passport" ${doc ? 'disabled' : ''}><small>Lowercase letters, numbers, hyphens, or underscores. Cannot be changed later.</small></div><div class="form-field"><label for="name">Document name</label><input id="name" required maxlength="100" value="${esc(doc?.name || '')}" placeholder="e.g. Passport"></div><div class="form-field"><label for="sort">Display order</label><input id="sort" type="number" step="1" value="${Number.isInteger(doc?.sort_order) ? doc.sort_order : (doc ? '' : 1)}"><small>${doc && !Number.isInteger(doc.sort_order) ? 'The server does not return the existing order. Enter it before saving.' : 'Smaller numbers appear first.'}</small></div></div><label class="check"><input id="required" type="checkbox" ${doc?.required ? 'checked' : ''}> This document is required</label><label class="check"><input id="active" type="checkbox" ${doc ? (doc.active ? 'checked' : '') : 'checked'}> Active in the user portal</label><div class="error" id="modalError" role="alert"></div><div class="modal-actions"><button type="button" class="outline" id="cancel">Cancel</button><button class="primary" type="submit">${doc ? 'Save changes' : 'Add document'}</button></div></form>`);
  document.getElementById('cancel').onclick = closeModal;
  document.getElementById('editor').onsubmit = async e => {
    e.preventDefault();
    const id = doc?.documentId || document.getElementById('id').value.trim(), name = document.getElementById('name').value.trim(), sortValue = document.getElementById('sort').value;
    const sort = Number(sortValue);
    if (!/^[a-z][a-z0-9_-]*$/.test(id) || !name || sortValue === '' || !Number.isSafeInteger(sort)) return errorInModal('Enter a valid ID, name, and whole-number display order.');
    const payload = { documentId: id, name, required: document.getElementById('required').checked, sort_order: sort, active: document.getElementById('active').checked };
    const button = e.submitter || document.querySelector('#editor button[type=submit]');
    button.disabled = true;
    try {
      const result = await request(doc ? API + '/edit-document' : API + '/add-document', doc ? 'PUT' : 'POST', payload);
      closeModal();
      if (result.cache_refreshed !== false) await loadDocuments(id);
      showSaveNotice(result)
    } catch (err) {
      errorInModal(err.message);
      button.disabled = false
    }
  };
}
function fieldForm(doc, field = null) {
  openModal(field ? 'Edit field' : 'Add a field', `<form id="editor"><div class="form-grid"><div class="form-field"><label for="key">Field key</label><input id="key" required pattern="[a-z][a-z0-9_]*" maxlength="50" value="${esc(field?.key || '')}" placeholder="e.g. number" ${field ? 'disabled' : ''}><small>Lowercase letters, numbers, or underscores. Cannot be changed later.</small></div><div class="form-field"><label for="label">Field label</label><input id="label" required maxlength="100" value="${esc(field?.label || '')}" placeholder="e.g. Passport number"></div><div class="form-field"><label for="type">Field type</label><select id="type"><option value="text" ${field?.type === 'text' ? 'selected' : ''}>Text</option><option value="date" ${field?.type === 'date' ? 'selected' : ''}>Date</option></select></div><div class="form-field full"><label for="pattern">Validation pattern <span style="font-weight:400;color:#9aa8b8">(optional)</span></label><input id="pattern" value="${esc(field?.pattern || '')}" placeholder="e.g. ^[A-Z]{5}[0-9]{4}[A-Z]$"><small>Regular expression checked by the server. Use a pattern compatible with Go and JavaScript.</small></div></div><label class="check"><input id="required" type="checkbox" ${field?.required ? 'checked' : ''}> This field is required</label><label class="check"><input id="notFuture" type="checkbox" ${field?.not_future ? 'checked' : ''}> Do not allow future dates <span>(date fields only)</span></label><label class="check"><input id="active" type="checkbox" ${field ? (field.active ? 'checked' : '') : 'checked'}> Active in the user portal</label><div class="error" id="modalError" role="alert"></div><div class="modal-actions"><button type="button" class="outline" id="cancel">Cancel</button><button class="primary" type="submit">${field ? 'Save changes' : 'Add field'}</button></div></form>`, doc.name.toUpperCase());
  const type = document.getElementById('type'), notFuture = document.getElementById('notFuture');
  const toggle = () => {
    notFuture.disabled = type.value !== 'date';
    if (notFuture.disabled) notFuture.checked = false
  };
  type.onchange = toggle;
  toggle();
  document.getElementById('cancel').onclick = closeModal;
  document.getElementById('editor').onsubmit = async e => {
    e.preventDefault();
    const key = field?.key || document.getElementById('key').value.trim(), label = document.getElementById('label').value.trim(), pattern = document.getElementById('pattern').value.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(key) || !label) return errorInModal('Enter a valid field key and label.');
    if (pattern) { try { new RegExp(pattern) } catch { return errorInModal('Enter a valid regular expression.') } } const payload = { documentId: doc.documentId, key, label, type: type.value, required: document.getElementById('required').checked, pattern: pattern || null, not_future: notFuture.checked, active: document.getElementById('active').checked };
    const button = e.submitter || document.querySelector('#editor button[type=submit]');
    button.disabled = true;
    try {
      const result = await request(field ? API + '/edit-field' : API + '/add-field', field ? 'PUT' : 'POST', payload);
      closeModal();
      if (result.cache_refreshed !== false) await loadDocuments(doc.documentId);
      showSaveNotice(result)
    } catch (err) {
      errorInModal(err.message);
      button.disabled = false
    }
  };
}
// Keep the page open on failure: a failed request does not prove the session was revoked.
document.getElementById('logoutButton').onclick = async event => {
  const button = event.currentTarget;
  const error = document.getElementById('logoutError');
  button.disabled = true;
  button.textContent = 'Logging out…';
  error.hidden = true;
  error.textContent = '';
  try {
    const response = await fetch(API + '/logout', { method: 'POST', credentials: 'same-origin' });
    if (response.ok || response.status === 401) {
      window.location.replace(API + '/login');
      return;
    }
    let body = {}; try { body = await response.json(); } catch { }
    error.textContent = (typeof body.error === 'string' && body.error) || 'Could not log out. Please try again.';
  } catch {
    error.textContent = 'Unable to reach the server. Please try again.';
  }
  error.hidden = false;
  button.disabled = false;
  button.textContent = 'Log out';
};
document.getElementById('addDocument').onclick = () => documentForm();
loadDocuments();
