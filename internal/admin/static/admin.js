// Proposed admin endpoints; no admin backend is implemented in this change.
const API = '/admin/document-types';
const list = document.getElementById('documentList');
const detail = document.getElementById('detail');
const modal = document.getElementById('modal');
let documents = [], selected = null, opener = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const path = value => encodeURIComponent(value);
async function request(url, method = 'GET', payload) {
  let response;
  try { response = await fetch(url, { method, credentials: 'same-origin', headers: payload === undefined ? {} : { 'Content-Type': 'application/json' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }); }
  catch { throw new Error('Unable to reach the server. Please try again.'); }
  let body = {}; try { body = await response.json(); } catch { }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : `Request failed (${response.status}). Please try again.`);
  return body;
}
async function loadDocuments(preferred = selected) {
  list.innerHTML = '<div class="empty">Loading document types…</div>';
  try {
    const response = await request(API);
    if (!Array.isArray(response.documents)) throw new Error('The server returned an invalid document list.');
    documents = response.documents;
    selected = documents.some(d => d.document_id === preferred) ? preferred : (documents[0]?.document_id || null);
    render();
  } catch (error) {
    documents = []; selected = null;
    document.getElementById('count').textContent = '— DOCUMENTS';
    list.innerHTML = `<div class="card empty"><b>Unable to load documents</b><p>${esc(error.message)}</p><button class="outline small-btn" id="retry">Try again</button></div>`;
    detail.innerHTML = '<div class="empty"><div class="empty-icon">▤</div><b>Documents unavailable</b><p>Connect the admin API to manage your configuration.</p></div>';
    document.getElementById('retry').onclick = () => loadDocuments();
  }
}
function render() {
  document.getElementById('count').textContent = `${documents.length} ${documents.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'}`;
  list.innerHTML = documents.length ? documents.map(d => `<button class="doc-item ${d.document_id === selected ? 'active' : ''}" data-document="${esc(d.document_id)}"><span class="doc-icon">▤</span><span><b>${esc(d.name)}</b><small>${(d.fields || []).length} fields · ${d.required ? 'Required' : 'Optional'}</small></span><span class="chevron">›</span></button>`).join('') : '<div class="card empty"><b>No document types yet</b><p>Add your first document to get started.</p></div>';
  list.querySelectorAll('[data-document]').forEach(button => button.onclick = () => { selected = button.dataset.document; render() });
  const doc = documents.find(d => d.document_id === selected);
  if (!doc) { detail.innerHTML = '<div class="empty"><div class="empty-icon">▤</div><b>Select a document</b><p>Its fields and settings will appear here.</p></div>'; return; }
  detail.innerHTML = `<div class="detail-top"><div class="detail-title"><div class="doc-icon">▤</div><div><h3>${esc(doc.name)}</h3><p>ID: ${esc(doc.document_id)} &nbsp; <span class="badge ${doc.required ? '' : 'optional'}">${doc.required ? 'Required' : 'Optional'}</span></p></div></div><div class="actions"><button class="outline small-btn" id="editDocument">Edit document</button><button class="danger small-btn" id="deleteDocument">Delete</button></div></div><div class="separator"></div><div class="fields-heading"><div><h4>Fields</h4><p>Details collected for this document.</p></div><button class="outline small-btn" id="addField">＋ &nbsp; Add field</button></div><div class="field-list">${(doc.fields || []).length ? doc.fields.map(f => `<div class="field-row"><div class="field-ico">${f.type === 'date' ? '▦' : 'Aa'}</div><div class="field-copy"><b>${esc(f.label)}</b><p>${esc(f.key)} · ${esc(f.type)} · ${f.required ? 'Required' : 'Optional'}${f.pattern ? ' · Pattern set' : ''}${f.not_future ? ' · No future dates' : ''}</p></div><div class="field-actions"><button class="icon-btn" data-edit-field="${esc(f.key)}" aria-label="Edit ${esc(f.label)}">Edit</button><button class="icon-btn delete" data-delete-field="${esc(f.key)}" aria-label="Delete ${esc(f.label)}">Delete</button></div></div>`).join('') : '<div class="empty">No fields yet. Add a field to start collecting details.</div>'}</div>`;
  document.getElementById('editDocument').onclick = () => documentForm(doc);
  document.getElementById('deleteDocument').onclick = () => confirmDelete('document', doc);
  document.getElementById('addField').onclick = () => fieldForm(doc);
  detail.querySelectorAll('[data-edit-field]').forEach(b => b.onclick = () => fieldForm(doc, doc.fields.find(f => f.key === b.dataset.editField)));
  detail.querySelectorAll('[data-delete-field]').forEach(b => b.onclick = () => confirmDelete('field', doc, doc.fields.find(f => f.key === b.dataset.deleteField)));
}
function openModal(title, body, kicker = 'DOCUMENT SETTINGS') { opener = document.activeElement; document.getElementById('modalTitle').textContent = title; document.getElementById('modalKicker').textContent = kicker; document.getElementById('modalBody').innerHTML = body; modal.hidden = false; modal.querySelector('input:not([disabled]),select,button')?.focus(); }
function closeModal() { modal.hidden = true; document.getElementById('modalBody').innerHTML = ''; if (opener?.isConnected) opener.focus(); }
document.getElementById('closeModal').onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal() };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal() });
function errorInModal(message) { document.getElementById('modalError').textContent = message; }
function documentForm(doc = null) {
  openModal(doc ? 'Edit document' : 'Add a document', `<form id="editor"><div class="form-grid"><div class="form-field"><label for="id">Document ID</label><input id="id" required pattern="[a-z][a-z0-9_-]*" maxlength="50" value="${esc(doc?.document_id || '')}" placeholder="e.g. passport" ${doc ? 'disabled' : ''}><small>Lowercase letters, numbers, hyphens, or underscores. Cannot be changed later.</small></div><div class="form-field"><label for="name">Document name</label><input id="name" required maxlength="100" value="${esc(doc?.name || '')}" placeholder="e.g. Passport"></div><div class="form-field"><label for="sort">Display order</label><input id="sort" type="number" step="1" value="${Number.isInteger(doc?.sort_order) ? doc.sort_order : 0}"><small>Smaller numbers appear first.</small></div></div><label class="check"><input id="required" type="checkbox" ${doc?.required ? 'checked' : ''}> This document is required</label><div class="error" id="modalError" role="alert"></div><div class="modal-actions"><button type="button" class="outline" id="cancel">Cancel</button><button class="primary" type="submit">${doc ? 'Save changes' : 'Add document'}</button></div></form>`);
  document.getElementById('cancel').onclick = closeModal;
  document.getElementById('editor').onsubmit = async e => { e.preventDefault(); const id = doc?.document_id || document.getElementById('id').value.trim(), name = document.getElementById('name').value.trim(), sortValue = document.getElementById('sort').value; const sort = Number(sortValue); if (!/^[a-z][a-z0-9_-]*$/.test(id) || !name || sortValue === '' || !Number.isSafeInteger(sort)) return errorInModal('Enter a valid ID, name, and whole-number display order.'); const payload = { name, required: document.getElementById('required').checked, sort_order: sort }; if (!doc) payload.id = id; const button = e.submitter; button.disabled = true; try { await request(doc ? `${API}/${path(id)}` : API, doc ? 'PUT' : 'POST', payload); closeModal(); await loadDocuments(id) } catch (err) { errorInModal(err.message); button.disabled = false } };
}
function fieldForm(doc, field = null) {
  openModal(field ? 'Edit field' : 'Add a field', `<form id="editor"><div class="form-grid"><div class="form-field"><label for="key">Field key</label><input id="key" required pattern="[a-z][a-z0-9_]*" maxlength="50" value="${esc(field?.key || '')}" placeholder="e.g. number" ${field ? 'disabled' : ''}><small>Lowercase letters, numbers, or underscores. Cannot be changed later.</small></div><div class="form-field"><label for="label">Field label</label><input id="label" required maxlength="100" value="${esc(field?.label || '')}" placeholder="e.g. Passport number"></div><div class="form-field"><label for="type">Field type</label><select id="type"><option value="text" ${field?.type === 'text' ? 'selected' : ''}>Text</option><option value="date" ${field?.type === 'date' ? 'selected' : ''}>Date</option></select></div><div class="form-field full"><label for="pattern">Validation pattern <span style="font-weight:400;color:#9aa8b8">(optional)</span></label><input id="pattern" value="${esc(field?.pattern || '')}" placeholder="e.g. ^[A-Z]{5}[0-9]{4}[A-Z]$"><small>Regular expression checked by the server. Use a pattern compatible with Go and JavaScript.</small></div></div><label class="check"><input id="required" type="checkbox" ${field?.required ? 'checked' : ''}> This field is required</label><label class="check"><input id="notFuture" type="checkbox" ${field?.not_future ? 'checked' : ''}> Do not allow future dates <span>(date fields only)</span></label><div class="error" id="modalError" role="alert"></div><div class="modal-actions"><button type="button" class="outline" id="cancel">Cancel</button><button class="primary" type="submit">${field ? 'Save changes' : 'Add field'}</button></div></form>`, doc.name.toUpperCase());
  const type = document.getElementById('type'), notFuture = document.getElementById('notFuture'); const toggle = () => { notFuture.disabled = type.value !== 'date'; if (notFuture.disabled) notFuture.checked = false }; type.onchange = toggle; toggle();
  document.getElementById('cancel').onclick = closeModal;
  document.getElementById('editor').onsubmit = async e => { e.preventDefault(); const key = field?.key || document.getElementById('key').value.trim(), label = document.getElementById('label').value.trim(), pattern = document.getElementById('pattern').value.trim(); if (!/^[a-z][a-z0-9_]*$/.test(key) || !label) return errorInModal('Enter a valid field key and label.'); if (pattern) { try { new RegExp(pattern) } catch { return errorInModal('Enter a valid regular expression.') } } const payload = { label, type: type.value, required: document.getElementById('required').checked, pattern: pattern || null, not_future: notFuture.checked }; if (!field) payload.key = key; const button = e.submitter; button.disabled = true; try { const url = `${API}/${path(doc.document_id)}/fields${field ? '/' + path(key) : ''}`; await request(url, field ? 'PUT' : 'POST', payload); closeModal(); await loadDocuments(doc.document_id) } catch (err) { errorInModal(err.message); button.disabled = false } };
}
function confirmDelete(kind, doc, field) { const item = kind === 'document' ? doc.name : field.label; openModal(`Delete ${kind}?`, `<p class="warning">Are you sure you want to delete <strong>${esc(item)}</strong>? This may affect existing submissions. The server may reject deletion when records depend on it.</p><div class="error" id="modalError" role="alert"></div><div class="modal-actions"><button class="outline" id="cancel">Cancel</button><button class="danger" id="confirmDelete">Delete ${kind}</button></div>`); document.getElementById('cancel').onclick = closeModal; document.getElementById('confirmDelete').onclick = async e => { const button = e.currentTarget; button.disabled = true; try { const url = `${API}/${path(doc.document_id)}${kind === 'field' ? '/fields/' + path(field.key) : ''}`; await request(url, 'DELETE'); closeModal(); await loadDocuments(kind === 'field' ? doc.document_id : null) } catch (err) { errorInModal(err.message); button.disabled = false } }; }
document.getElementById('addDocument').onclick = () => documentForm();
loadDocuments();
