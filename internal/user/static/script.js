// Document photographs remain on the device; only text is submitted.
const API_BASE = '/user';
const card = document.getElementById('mainCard');
let phone = '', activeDoc = '', step = 1, documents = [], fields = {}, data = {}, fieldErrors = {};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errorKey = (doc, field) => `${doc}:${field}`;
async function api(path, options = {}) {
    let response;
    try { response = await fetch(API_BASE + path, {...options, headers: {'Content-Type':'application/json', ...(options.headers || {})}}); }
    catch { throw new Error('Cannot reach the server. Please check your connection or try again later.'); }
    let body = {}; try { body = await response.json(); } catch {}
    if (!response.ok) {
        const error = new Error(body.error || body.message || `Request failed (${response.status}). Please try again.`);
        error.documentTypeId = body.documentId;
        error.fieldKey = body.field_key;
        throw error;
    }
    return body;
}
const post = (path, payload) => api(path, {method:'POST', body:JSON.stringify(payload)});
function setStep(n) {
    step=n;
    document.querySelectorAll('.step').forEach(el=>{const s=+el.dataset.step;el.classList.toggle('current',s===n);el.classList.toggle('done',s<n);el.querySelector('span').textContent=s<n?'✓':s;});
    render();
}
function showError(message) { const el=document.getElementById('error'); if(el) el.textContent=message; }
function busy(button, state, label) { button.disabled=state; if(label)button.textContent=label; }
function displayFieldError(docId, key, message) {
    if (key === 'phone' && !docId) { fieldErrors.phone=message; setStep(1); document.getElementById('phone')?.focus(); return; }
    const doc=documents.find(d=>d.documentId===docId);
    if (!doc || !doc.fields.some(f=>f.key===key)) { showError(message); return; }
    fieldErrors[errorKey(docId,key)]=message;
    activeDoc=docId; setStep(2);
    [...document.querySelectorAll('[data-field]')].find(input=>input.dataset.field===key)?.focus();
}
function render() {
    if(step===1){
        card.innerHTML=`<div class="card-kicker">STEP 01 / 04</div><h2>First, your phone number.</h2><p class="card-desc">Enter the number you would like to link to this submission.</p><div class="form-divider"></div><form id="phoneForm" novalidate><label class="field-label" for="phone">Phone number</label><div class="phone-input"><span class="prefix">+91</span><input id="phone" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="Enter your 10-digit number" value="${escapeHTML(phone)}" aria-describedby="phone-error" ${fieldErrors.phone?'aria-invalid="true"':''}></div><div class="field-message" id="phone-error" role="alert">${escapeHTML(fieldErrors.phone||'')}</div><p class="hint">Enter your number for each submission. No OTP is required.</p><div id="error" class="error" role="alert"></div><button class="primary" type="submit">Continue <span>→</span></button></form><div class="disclaimer">Your phone number and document details are submitted together.</div>`;
        document.getElementById('phone').oninput=()=>{delete fieldErrors.phone;document.getElementById('phone-error').textContent='';document.getElementById('phone').removeAttribute('aria-invalid');};
        document.getElementById('phoneForm').onsubmit=async e=>{e.preventDefault();phone=document.getElementById('phone').value.trim();if(!/^\d{10}$/.test(phone))return displayFieldError('', 'phone', 'Please enter a valid 10-digit phone number.');const btn=e.submitter||document.querySelector('#phoneForm button[type=submit]');busy(btn,true,'Loading...');try{const result=await api('/document-types');if(!Array.isArray(result.documents)||!result.documents.length)throw new Error('No document types are configured on the server.');const old=data;documents=result.documents;fields={};data={};for(const d of documents){fields[d.documentId]=d.fields;data[d.documentId]=old[d.documentId]||{}}activeDoc=documents.some(d=>d.documentId===activeDoc)?activeDoc:documents[0].documentId;setStep(2)}catch(err){showError(err.message);busy(btn,false,'Continue →')}};
        return;
    }
    if(step===4){card.innerHTML=`<div class="success"><div class="success-icon">✓</div><h2>Submitted successfully.</h2><p>Your details have been submitted. For your privacy, you cannot view your submission here again.</p><button class="outline" id="restart">Start a new submission</button></div>`;document.getElementById('restart').onclick=()=>{phone='';documents=[];fields={};data={};fieldErrors={};setStep(1)};return;}
    if(step===3){
        const included=documents.filter(d=>d.required||Object.values(data[d.documentId]).some(v=>v.trim()));
        card.innerHTML=`<div class="card-kicker">STEP 03 / 04</div><h2>Review your details.</h2><p class="card-desc">Check your phone number and document details before submitting.</p><div class="review-section"><div class="review-heading"><h3>Phone number</h3><button class="review-edit" id="editPhone">Edit</button></div><div class="review-row"><span>Mobile number</span><strong>+91 ${escapeHTML(phone)}</strong></div></div>${included.map(d=>`<div class="review-section"><div class="review-heading"><h3>${escapeHTML(d.name)}</h3><button class="review-edit" data-edit-doc="${escapeHTML(d.documentId)}">Edit</button></div>${d.fields.filter(f=>data[d.documentId][f.key]?.trim()).map(f=>`<div class="review-row"><span>${escapeHTML(f.label)}</span><strong>${escapeHTML(data[d.documentId][f.key])}</strong></div>`).join('')}</div>`).join('')}<div id="error" class="error" role="alert"></div><div class="action-row"><button class="primary" id="confirm">Confirm & submit <span>→</span></button><button class="outline" id="editDetails">← Edit details</button></div><div class="disclaimer">Please confirm your details are correct. They cannot be viewed here after submission.</div>`;
        document.getElementById('editPhone').onclick=()=>setStep(1);
        document.getElementById('editDetails').onclick=()=>setStep(2);
        document.querySelectorAll('[data-edit-doc]').forEach(b=>b.onclick=()=>{activeDoc=b.dataset.editDoc;setStep(2)});
        document.getElementById('confirm').onclick=async e=>{const btn=e.currentTarget;busy(btn,true,'Submitting...');const payload={phone,documents:included.map(d=>({documentId:d.documentId,fields:data[d.documentId]}))};try{await post('/submissions',payload);phone='';data={};fields={};documents=[];fieldErrors={};setStep(4)}catch(err){if(err.fieldKey){displayFieldError(err.documentTypeId||'',err.fieldKey,err.message);}else showError(err.message);if(btn.isConnected)busy(btn,false,'Confirm & submit →')}};
        return;
    }
    const doc=documents.find(d=>d.documentId===activeDoc);if(!doc)return;
    card.innerHTML=`<div class="card-kicker">STEP 02 / 04</div><h2>Add your identity details.</h2><p class="card-desc">Choose a document and enter its details. Add the optional documents you have.</p><div class="doc-tabs">${documents.map(d=>`<button type="button" class="doc-tab ${d.documentId===activeDoc?'active':''}" data-doc="${escapeHTML(d.documentId)}">${escapeHTML(d.name)} ${d.required?'<span class="required">*</span>':''} ${Object.values(data[d.documentId]).some(Boolean)?'✓':''}</button>`).join('')}</div><div class="form-divider"></div><div class="table-heading"><div><h2>${escapeHTML(doc.name)}</h2><p class="card-desc">${doc.required?'Required for submission':'Optional document'}</p></div><button class="outline" id="scan" type="button">Scan with camera</button></div><p class="hint">Scan on your device or type your details. Check extracted text before submitting.</p><div class="fields">${doc.fields.length === 0 ? '<p class="no-fields">No fields are configured for this document yet. Please contact the administrator.</p>' : doc.fields.map((f,i)=>{const message=fieldErrors[errorKey(activeDoc,f.key)]||'';return `<div class="field ${f.key==='name'?'full':''}"><label class="field-label" for="field-${i}">${escapeHTML(f.label)} ${f.required?'<span class="required">*</span>':''}</label><input id="field-${i}" data-field="${escapeHTML(f.key)}" type="${f.type==='date'?'date':'text'}" placeholder="Enter ${escapeHTML(f.label.toLowerCase())}" value="${escapeHTML(data[activeDoc][f.key]||'')}" aria-describedby="field-error-${i}" ${message?'aria-invalid="true" class="field-error"':''}><div class="field-message" id="field-error-${i}" role="alert">${escapeHTML(message)}</div></div>`}).join('')}</div><div id="error" class="error" role="alert"></div><div class="action-row"><button class="primary" id="review">Review details <span>→</span></button><button class="outline" id="back">← Change number</button></div><div class="disclaimer">Only text details are sent. Your document photo stays on this device.</div>`;
    document.querySelectorAll('[data-field]').forEach(x=>x.addEventListener('input',()=>{data[activeDoc][x.dataset.field]=x.value;delete fieldErrors[errorKey(activeDoc,x.dataset.field)];x.classList.remove('field-error');x.removeAttribute('aria-invalid');document.getElementById(x.getAttribute('aria-describedby')).textContent='';}));
    document.querySelectorAll('[data-doc]').forEach(x=>x.onclick=()=>{activeDoc=x.dataset.doc;render()});
    document.getElementById('back').onclick=()=>setStep(1);
    document.getElementById('scan').onclick=openScanner;
    document.getElementById('review').onclick=()=>{
        for(const d of documents){const values=data[d.documentId];if(!d.required&&!Object.values(values).some(v=>v.trim()))continue;for(const f of d.fields){const val=(values[f.key]||'').trim();if(f.required&&!val)return displayFieldError(d.documentId,f.key,`${f.label} is required.`);if(!val)continue;if(f.pattern){try{if(!new RegExp(f.pattern).test(val))return displayFieldError(d.documentId,f.key,`Please enter a valid ${f.label}.`);}catch{/* The server validates unsupported patterns. */}}if(f.type==='date'){const valid=/^\d{4}-\d{2}-\d{2}$/.test(val)&&!isNaN(Date.parse(val))&&new Date(val+'T00:00:00Z').toISOString().slice(0,10)===val;if(!valid)return displayFieldError(d.documentId,f.key,'Please enter a valid date.');const today=new Date();const localToday=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');if(f.not_future&&val>localToday)return displayFieldError(d.documentId,f.key,`${f.label} cannot be in the future.`);}}}
        setStep(3);
    };
}
render();
let scannerStream = null, ocrWorker = null;

async function openScanner() {
    const overlay = document.createElement('div');
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = `<div class="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanTitle"><div class="scanner-heading"><div><div class="card-kicker">PRIVATE ON-DEVICE SCAN</div><h2 id="scanTitle">Scan your ${escapeHTML(documents.find(d => d.documentId === activeDoc)?.name || activeDoc)}</h2></div><button class="close-scan" aria-label="Close scanner">x</button></div><p class="card-desc">Position your document clearly in the frame. Recognition runs in your browser; your photo is not uploaded.</p><div class="camera-frame"><video autoplay playsinline muted></video><canvas hidden></canvas><div class="camera-placeholder">Starting your camera...</div></div><p class="scan-status">Allow camera access when prompted.</p><div class="scan-actions"><button class="primary capture" disabled>Capture &amp; scan <span>-&gt;</span></button><label class="outline upload">Choose photo <input type="file" accept="image/*" capture="environment" hidden></label></div><p class="scan-footnote">The OCR engine and language data are downloaded to your browser. Review all extracted details before submitting.</p></div>`;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('video');
    const status = overlay.querySelector('.scan-status');
    const placeholder = overlay.querySelector('.camera-placeholder');
    const capture = overlay.querySelector('.capture');
    let closed = false;

    function close() {
        closed = true;
        if (scannerStream) {
            scannerStream.getTracks().forEach(t => t.stop());
            scannerStream = null;
        }
        overlay.remove();
    }

    overlay.querySelector('.close-scan').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };

    async function scan(source) {
        capture.disabled = true;
        status.textContent = 'Loading on-device text recognition. This may take a moment on the first scan...';

        try {
            if (!window.Tesseract) {
                await new Promise((resolve, reject) => {
                    let script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Could not load the OCR library. Check your internet connection.'));
                    document.head.appendChild(script);
                });
            }

            if (!ocrWorker) {
                ocrWorker = await window.Tesseract.createWorker('eng', 1, {
                    logger: m => {
                        if (!closed && m.status === 'recognizing text') {
                            status.textContent = 'Reading text on your device... ' + Math.round(m.progress * 100) + '%';
                        }
                    }
                });
            }

            const prepared = await prepareImage(source);
            const result = await ocrWorker.recognize(prepared);
            if (closed) return;

            let text = result.data.text;
            const doc = activeDoc;
            const docName = (documents.find(d => d.documentId === doc)?.name || doc).toLowerCase();
            let foundName = extractName(text, docName);

            if (!foundName || (docName.includes('aadhaar') && !/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text))) {
                status.textContent = 'Trying a second pass on the original image...';
                const retry = await ocrWorker.recognize(source);
                if (closed) return;
                foundName = foundName || extractName(retry.data.text, docName);
                text += '\n' + retry.data.text;
            }

            let number = '';

            if (docName.includes('aadhaar')) {
                let m = text.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
                if (m) number = m[0].replace(/\D/g, '');
            } else if (docName.includes('pan')) {
                let m = text.toUpperCase().match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
                if (m) number = m[0];
            } else if (docName.includes('passport')) {
                let m = text.toUpperCase().match(/\b[A-Z][0-9]{7}\b/);
                if (m) number = m[0];
            } else {
                let m = text.toUpperCase().match(/\b[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4,13}\b/);
                if (m) number = m[0];
            }

            if (number && fields[doc].some(f => f.key === 'number')) data[doc].number = number;
            if (foundName && fields[doc].some(f => f.key === 'name')) data[doc].name = foundName;

            let dob = text.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/);
            if (dob && fields[doc].some(f => f.key === 'dob')) data[doc].dob = dob[3] + '-' + dob[2] + '-' + dob[1];

            close();
            render();

            document.getElementById('error').style.color = '#658a70';
            document.getElementById('error').textContent = number || dob || foundName
                ? 'Scan complete. Please check extracted fields and enter anything missing.'
                : 'No matching details found. Move closer, use even light without glare, or choose a sharp photo. You can also enter details manually.';
        } catch (err) {
            if (!closed) {
                status.textContent = err.message || 'Scanning failed. Try again or enter details manually.';
                capture.disabled = !scannerStream;
            }
        }
    }

    capture.onclick = () => {
        const canvas = overlay.querySelector('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        if (scannerStream) {
            scannerStream.getTracks().forEach(t => t.stop());
            scannerStream = null;
        }

        video.style.display = 'none';
        canvas.hidden = false;
        scan(canvas);
    };

    overlay.querySelector('input[type=file]').onchange = e => {
        const file = e.target.files[0];
        if (file) scan(file);
    };

    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Camera requires a secure connection. You can choose a photo instead.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        if (closed) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        scannerStream = stream;
        video.srcObject = stream;
        placeholder.style.display = 'none';
        capture.disabled = false;
        status.textContent = 'Fill the frame with the card. Hold steady, tap to focus if your phone supports it, and avoid glare.';
    } catch (e) {
        if (!closed) {
            placeholder.textContent = 'Camera unavailable';
            status.textContent = 'Camera access was unavailable. Choose a photo or enter details manually.';
        }
    }
}

// Image processing and OCR execute entirely in the browser. The original image is never uploaded.
async function prepareImage(source) {
    let image = source, objectUrl;

    if (source instanceof Blob) {
        objectUrl = URL.createObjectURL(source);
        image = new Image();
        image.src = objectUrl;
        await image.decode();
    }

    const w = image.videoWidth || image.naturalWidth || image.width;
    const h = image.videoHeight || image.naturalHeight || image.height;

    if (!w || !h) throw new Error('Unable to read this image. Please try another photo.');

    const scale = Math.min(2, 2400 / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const a = pixels.data;

    for (let i = 0; i < a.length; i += 4) {
        let gray = .299 * a[i] + .587 * a[i + 1] + .114 * a[i + 2];
        gray = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
        a[i] = a[i + 1] = a[i + 2] = gray;
    }

    ctx.putImageData(pixels, 0, 0);

    return canvas;
}

function extractName(text, doc) {
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

    for (const line of lines) {
        const m = line.match(/^(?:full\s+)?name\s*[:\-]\s*([A-Za-z][A-Za-z .]{2,})$/i);
        if (m && !/father|mother|husband|government|india/i.test(m[1])) return m[1].trim();
    }

    if (!doc.includes('aadhaar')) return '';

    const candidates = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/government|india|authority|unique|identification|aadhaar|aadhar|enrol|address|date|birth|male|female|father|mother|husband|care|download|issue|\bvid\b|www|help|\bdob\b|year|daughter|resident|\d/i.test(line)) continue;

        // Ignore non-Latin script and isolated OCR specks instead of appending them to the name.
        let words = (line.match(/[A-Za-z]+/g) || []).filter(w => w.length >= 2);

        // Mixed-case OCR debris after a normally capitalized name is not part of the name.
        const titleRun = [];
        for (const word of words) {
            if (/^[A-Z][a-z]{2,}$/.test(word)) titleRun.push(word);
            else if (titleRun.length) break;
        }

        if (titleRun.length >= 2) words = titleRun;

        if (words.length < 2 || words.length > 5 || words.some(w => w.length > 22)) continue;

        const name = words.join(' ');
        if (name.length < 5 || name.length > 45) continue;

        let score = words.length === 2 ? 3 : 1;

        if (words.every(w => /^[A-Z][a-z]+$/.test(w))) score += 3;
        if (words.some(w => w.length <= 2)) score -= 2;

        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
            if (/dob|date of birth|year of birth|\b(?:male|female)\b|\d{2}[\/.-]\d{2}[\/.-]\d{4}/i.test(lines[j])) {
                score += 5 - (j - i);
                break;
            }
        }

        candidates.push({ name, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    return candidates[0]?.score >= 1 ? candidates[0].name : '';
}