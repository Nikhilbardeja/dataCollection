// No login or session: phone and document details are sent together on submit.
const API_BASE = '/user';
const card = document.getElementById('mainCard');
let phone = '', activeDoc = '', step = 1, documents = [], fields = {}, data = {};

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, options = {}) {
    let response;
    try {
        response = await fetch(API_BASE + path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
    } catch {
        throw new Error('Cannot reach the server. Please check your connection or try again later.');
    }

    let body = {};
    try {
        body = await response.json();
    } catch { }

    if (!response.ok) {
    const msg = typeof body.error === 'string' ? body.error : (typeof body.message === 'string' ? body.message : '');
    throw new Error(msg || `Request failed (${response.status}). Please try again.`);
}

    return body;
}

const post = (path, payload) => api(path, { method: 'POST', body: JSON.stringify(payload) });

function setStep(n) {
    step = n;

    document.querySelectorAll('.step').forEach(el => {
        let s = +el.dataset.step;
        el.classList.toggle('current', s === n);
        el.classList.toggle('done', s < n);
        el.querySelector('span').textContent = s < n ? 'v' : s;
    });

    render();
}

function showError(message) {
    document.getElementById('error').textContent = message;
}
function highlightFromError(message) {
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));

    // 1. Pehle error dikhao, chahe kuch bhi ho - ye sabse important hai
    showError(message);

    // 2. Ab highlight dhoondho - message ke shuru me document hai kya?
    let docId = '';
    let fieldKey = '';
    for (const d of documents) {
        if (message.startsWith(d.document_type_id)) {
            docId = d.document_type_id;
            // us document ke fields me se kaunsa field message me hai?
            for (const f of d.fields) {
                if (message.includes(f.key)) {
                    fieldKey = f.key;
                    break;
                }
            }
            break;
        }
    }
    if (!docId) return;

    // 3. Us document pe le jao
    if (documents.some(d => d.document_type_id === docId)) {
        activeDoc = docId;
        render();
        showError(message); // render() ne #error ko dobara bana diya, isliye phir se dikhao
    }

    // 4. Us field ko highlight kar do
    if (fieldKey) {
        const input = document.querySelector(`[data-field="${fieldKey}"]`);
        if (input) {
            input.classList.add('field-error');
            input.focus();
        }
    }
}

function busy(button, state, label) {
    button.disabled = state;
    if (label) button.textContent = label;
}

function render() {
    if (step === 1) {
        card.innerHTML = `<div class="card-kicker">STEP 01 / 03</div><h2>First, your phone number.</h2><p class="card-desc">Enter the number you would like to link to this submission.</p><div class="form-divider"></div><form id="phoneForm"><label class="field-label" for="phone">Phone number</label><div class="phone-input"><span class="prefix">+91</span><input id="phone" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="Enter your 10-digit number" value="${escapeHTML(phone)}" required></div><p class="hint">Enter your number for each submission. No OTP is required.</p><div id="error" class="error" role="alert"></div><button class="primary" type="submit">Continue <span>-&gt;</span></button></form><div class="disclaimer">Your phone number and document details are submitted together.</div>`;

        document.getElementById('phoneForm').onsubmit = async e => {
            e.preventDefault();

            const v = document.getElementById('phone').value.trim();
            if (!/^\d{10}$/.test(v)) return showError('Please enter a valid 10-digit phone number.');

            phone = v;

            const btn = e.submitter;
            busy(btn, true, 'Loading...');

            try {
                const result = await api('/document-types');
                console.log(result);

                if (!Array.isArray(result.documents) || !result.documents.length) {
                    throw new Error('No document types are configured on the server.');
                }

                const oldData = data;
                documents = result.documents;
                fields = {};
                data = {};

                for (const d of documents) {
                    fields[d.document_type_id] = d.fields;
                    data[d.document_type_id] = oldData[d.document_type_id] || {};
                }

                activeDoc = documents.some(d => d.document_type_id === activeDoc) ? activeDoc : documents[0].document_type_id;

                setStep(2);
            } catch (err) {
                showError(err.message);
                busy(btn, false, 'Continue ->');
            }
        };

        return;
    }

    if (step === 3) {
        card.innerHTML = `<div class="success"><div class="success-icon">v</div><h2>Submitted successfully.</h2><p>Your details have been submitted. For your privacy, you cannot view your submission here again.</p><button class="outline" id="restart">Start a new submission</button></div>`;

        document.getElementById('restart').onclick = () => {
            phone = '';
            documents = [];
            fields = {};
            data = {};
            setStep(1);
        };

        return;
    }

    const doc = documents.find(d => d.document_type_id === activeDoc);
    if (!doc) return;

    card.innerHTML = `<div class="card-kicker">STEP 02 / 03</div><h2>Add your identity details.</h2><p class="card-desc">Choose a document and enter its details. Add the optional documents you have.</p><div class="doc-tabs">${documents.map(d => `<button type="button" class="doc-tab ${d.document_type_id === activeDoc ? 'active' : ''}" data-doc="${escapeHTML(d.document_type_id)}">${escapeHTML(d.name)} ${d.required ? '<span class="required">*</span>' : ''} ${Object.values(data[d.document_type_id]).some(Boolean) ? 'v' : ''}</button>`).join('')}</div><div class="form-divider"></div><div class="table-heading"><div><h2>${escapeHTML(doc.name)}</h2><p class="card-desc">${doc.required ? 'Required for submission' : 'Optional document'}</p></div><button class="outline" id="scan" type="button">Scan with camera</button></div><p class="hint">Scan on your device or type your details. Check extracted text before submitting.</p><div class="fields">${doc.fields.map(f => `<div class="field ${f.key === 'name' ? 'full' : ''}"><label class="field-label" for="field-${escapeHTML(f.key)}">${escapeHTML(f.label)} ${f.required ? '<span class="required">*</span>' : ''}</label><input id="field-${escapeHTML(f.key)}" data-field="${escapeHTML(f.key)}" type="${f.type === 'date' ? 'date' : 'text'}" placeholder="Enter ${escapeHTML(f.label.toLowerCase())}" value="${escapeHTML(data[activeDoc][f.key] || '')}"></div>`).join('')}</div><div id="error" class="error" role="alert"></div><div class="action-row"><button class="primary" id="submit">Submit details <span>-&gt;</span></button><button class="outline" id="back">&lt;- &nbsp; Change number</button></div><div class="disclaimer">Only text details are sent. Your document photo stays on this device.</div>`;

    document.querySelectorAll('[data-field]').forEach(x => x.addEventListener('input', () => data[activeDoc][x.dataset.field] = x.value));
    document.querySelectorAll('[data-doc]').forEach(x => x.onclick = () => { activeDoc = x.dataset.doc; render(); });
    document.getElementById('back').onclick = () => setStep(1);
    document.getElementById('scan').onclick = openScanner;

    document.getElementById('submit').onclick = async e => {
    for (const d of documents) {
        const values = data[d.document_type_id];
        const included = d.required || Object.values(values).some(v => v.trim());
        if (!included) continue;

        for (const f of d.fields) {
            const val = (values[f.key] || '').trim();

            // 1. Required check - pehle wala hi
            if (f.required && !val) {
                activeDoc = d.document_type_id;
                render();
                document.querySelector(`[data-field="${f.key}"]`)?.classList.add('field-error');
                return showError(`Please complete ${f.label} in ${d.name}.`);
            }
            if (!val) continue;

            // 2. Pattern check - Backend wala hi pattern, frontend me
            if (f.pattern) {
                try {
                    if (!new RegExp(f.pattern).test(val)) {
                        activeDoc = d.document_type_id;
                        render();
                        document.querySelector(`[data-field="${f.key}"]`)?.classList.add('field-error');
                        return showError(`${f.label} ka format galat hai in ${d.name}.`);
                    }
                } catch { /* agar pattern galat hua to backend sambhal lega */ }
            }

            // 3. Date + NotFuture check
            if (f.type === 'date') {
                const parsed = new Date(val);
                if (isNaN(parsed)) {
                    activeDoc = d.document_type_id;
                    render();
                    return showError(`${f.label} ki date galat hai in ${d.name}.`);
                }
                if (f.not_future) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (parsed > today) {
                        activeDoc = d.document_type_id;
                        render();
                        document.querySelector(`[data-field="${f.key}"]`)?.classList.add('field-error');
                        return showError(`${f.label} future ki date nahi ho sakti in ${d.name}.`);
                    }
                }
            }
        }
    }

        const payload = {
            phone,
            documents: documents
                .filter(d => d.required || Object.values(data[d.document_type_id]).some(v => v.trim()))
                .map(d => ({ document_type_id: d.document_type_id, fields: data[d.document_type_id] }))
        };

        let btn = e.currentTarget;
        busy(btn, true, 'Submitting...');

        try {
            await post('/submissions', payload);
            data = {};
            fields = {};
            documents = [];
            setStep(3);
        } catch (err) {
            highlightFromError(err.message);
            busy(btn, false, 'Submit details ->');
        }
    };
}

render();

let scannerStream = null, ocrWorker = null;

async function openScanner() {
    const overlay = document.createElement('div');
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = `<div class="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanTitle"><div class="scanner-heading"><div><div class="card-kicker">PRIVATE ON-DEVICE SCAN</div><h2 id="scanTitle">Scan your ${escapeHTML(documents.find(d => d.document_type_id === activeDoc)?.name || activeDoc)}</h2></div><button class="close-scan" aria-label="Close scanner">x</button></div><p class="card-desc">Position your document clearly in the frame. Recognition runs in your browser; your photo is not uploaded.</p><div class="camera-frame"><video autoplay playsinline muted></video><canvas hidden></canvas><div class="camera-placeholder">Starting your camera...</div></div><p class="scan-status">Allow camera access when prompted.</p><div class="scan-actions"><button class="primary capture" disabled>Capture &amp; scan <span>-&gt;</span></button><label class="outline upload">Choose photo <input type="file" accept="image/*" capture="environment" hidden></label></div><p class="scan-footnote">The OCR engine and language data are downloaded to your browser. Review all extracted details before submitting.</p></div>`;
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
            const docName = (documents.find(d => d.document_type_id === doc)?.name || doc).toLowerCase();
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