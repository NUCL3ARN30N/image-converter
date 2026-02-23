// ============================
// State
// ============================
const state = {
  files: [],
  results: [],
  converting: false,
  totalOriginalSize: 0,
  totalConvertedSize: 0
};

let fileIdCounter = 0;
let dragCounter = 0; // track nested drag enter/leave

const SUPPORTED_IMAGE_EXT = [
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'tif',
  'heic', 'heif', 'cr2', 'nef', 'arw', 'dng', 'bmp', 'svg'
];

// ============================
// DOM References
// ============================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const fileListEl = document.getElementById('fileList');
const fileItemsEl = document.getElementById('fileItems');
const fileBadge = document.getElementById('fileBadge');
const convertBtn = document.getElementById('convertBtn');
const resultsPanel = document.getElementById('resultsPanel');
const resultItemsEl = document.getElementById('resultItems');
const resultBadge = document.getElementById('resultBadge');
const batchProgress = document.getElementById('batchProgress');
const bpFill = document.getElementById('bpFill');
const bpLabel = document.getElementById('bpLabel');
const bpCount = document.getElementById('bpCount');

// ============================
// Drag & Drop
// ============================
// 1) Stop browser from navigating to dropped files — only preventDefault, NO stopPropagation
document.addEventListener('dragover', function(e) { e.preventDefault(); });
document.addEventListener('drop', function(e) { e.preventDefault(); });

// 2) Visual feedback uses a counter to handle child enter/leave correctly
dropZone.addEventListener('dragenter', function(e) {
  e.preventDefault();
  dragCounter++;
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  // Must prevent default here for drop to fire
});

dropZone.addEventListener('dragleave', function(e) {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropZone.classList.remove('drag-over');
  }
});

// 3) The actual drop handler
dropZone.addEventListener('drop', async function(e) {
  e.preventDefault();
  e.stopPropagation(); // stop document handler from also firing
  dragCounter = 0;
  dropZone.classList.remove('drag-over');

  let collected = [];

  // First try the items API for folder support
  if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    const promises = [];
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind !== 'file') continue;

      // Try filesystem entry API (works in Chrome, Edge, recent Firefox)
      let entry = null;
      if (typeof item.webkitGetAsEntry === 'function') {
        entry = item.webkitGetAsEntry();
      } else if (typeof item.getAsEntry === 'function') {
        entry = item.getAsEntry();
      }

      if (entry) {
        promises.push(traverseEntry(entry, ''));
      } else {
        const f = item.getAsFile();
        if (f) promises.push(Promise.resolve([{ file: f, path: '' }]));
      }
    }
    collected = (await Promise.all(promises)).flat();
  }

  // Fallback to the simpler files list
  if (collected.length === 0 && e.dataTransfer && e.dataTransfer.files) {
    collected = Array.from(e.dataTransfer.files).map(function(f) {
      return { file: f, path: '' };
    });
  }

  await processCollectedFiles(collected);
});

// Click to browse
dropZone.addEventListener('click', function(e) {
  if (e.target.closest('input')) return;
  fileInput.click();
});

// Browse buttons
document.getElementById('btnBrowseFiles').addEventListener('click', function() {
  fileInput.click();
});
document.getElementById('btnBrowseFolder').addEventListener('click', function() {
  folderInput.click();
});

// File input change
fileInput.addEventListener('change', async function() {
  const collected = Array.from(fileInput.files).map(function(f) {
    return { file: f, path: '' };
  });
  await processCollectedFiles(collected);
  fileInput.value = '';
});

// Folder input change
folderInput.addEventListener('change', function() {
  const files = Array.from(folderInput.files);
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (isImageFile(file)) {
      var path = file.webkitRelativePath
        ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
        : '';
      addFile(file, path);
    }
  }
  updateUI();
  folderInput.value = '';
});

// List action buttons
document.getElementById('btnSelectAll').addEventListener('click', function() {
  showToast('All files selected', 'success');
});
document.getElementById('btnClear').addEventListener('click', clearFiles);

// Settings
document.getElementById('outputFormat').addEventListener('change', updateQualityVisibility);
document.getElementById('qualitySlider').addEventListener('input', updateQualityLabel);
document.getElementById('convertBtn').addEventListener('click', startConversion);
document.getElementById('downloadAllBtn').addEventListener('click', downloadAll);

// ============================
// Traverse filesystem entries (for folder drop)
// ============================
function traverseEntry(entry, basePath) {
  return new Promise(function(resolve) {
    if (entry.isFile) {
      entry.file(function(f) {
        resolve([{ file: f, path: basePath }]);
      }, function() {
        resolve([]);
      });
    } else if (entry.isDirectory) {
      var dirReader = entry.createReader();
      var dirPath = basePath ? basePath + '/' + entry.name : entry.name;
      var allEntries = [];

      // readEntries may not return all entries at once, need to call repeatedly
      (function readAll() {
        dirReader.readEntries(async function(entries) {
          if (entries.length === 0) {
            // Done reading, now traverse collected entries
            var results = [];
            for (var i = 0; i < allEntries.length; i++) {
              var sub = await traverseEntry(allEntries[i], dirPath);
              results = results.concat(sub);
            }
            resolve(results);
          } else {
            allEntries = allEntries.concat(Array.from(entries));
            readAll(); // keep reading
          }
        }, function() {
          resolve([]);
        });
      })();
    } else {
      resolve([]);
    }
  });
}

// ============================
// Process collected files (shared by drop + file input)
// ============================
async function processCollectedFiles(collected) {
  if (!collected || collected.length === 0) {
    showToast('No supported files found', 'error');
    return;
  }

  var added = 0;
  for (var i = 0; i < collected.length; i++) {
    var file = collected[i].file;
    var path = collected[i].path;
    if (isZipFile(file)) {
      await handleZipFile(file);
      added++;
    } else if (isImageFile(file)) {
      addFile(file, path);
      added++;
    }
  }

  updateUI();
  if (added > 0) {
    showToast('Added ' + added + ' file(s)', 'success');
  } else {
    showToast('No supported image files found', 'error');
  }
}

// ============================
// File Helpers
// ============================
function isImageFile(file) {
  return SUPPORTED_IMAGE_EXT.indexOf(getExtension(file.name)) !== -1;
}

function isZipFile(file) {
  var name = file.name.toLowerCase();
  return name.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed';
}

function getExtension(name) {
  var parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function guessMime(name) {
  var ext = getExtension(name);
  var map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', tiff: 'image/tiff',
    tif: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
    bmp: 'image/bmp', svg: 'image/svg+xml',
    cr2: 'image/x-canon-cr2', nef: 'image/x-nikon-nef',
    arw: 'image/x-sony-arw', dng: 'image/x-adobe-dng'
  };
  return map[ext] || 'application/octet-stream';
}

// ============================
// ZIP Handling
// ============================
async function handleZipFile(file) {
  var overlay = document.getElementById('zipOverlay');
  var zipFill = document.getElementById('zipFill');
  var zipStatus = document.getElementById('zipStatus');
  document.getElementById('zipFileName').textContent = file.name;

  overlay.classList.add('active');
  zipFill.style.width = '0%';
  zipStatus.textContent = 'Reading archive...';

  try {
    var zip = await JSZip.loadAsync(file);
    var entries = [];
    zip.forEach(function(relativePath, zipEntry) {
      if (!zipEntry.dir && SUPPORTED_IMAGE_EXT.indexOf(getExtension(relativePath)) !== -1) {
        entries.push({ name: relativePath, entry: zipEntry });
      }
    });

    var total = entries.length;
    zipStatus.textContent = 'Found ' + total + ' images';

    for (var i = 0; i < total; i++) {
      var item = entries[i];
      zipFill.style.width = ((i + 1) / total * 100) + '%';
      zipStatus.textContent = 'Extracting ' + (i + 1) + '/' + total + ': ' + item.name.split('/').pop();

      var blob = await item.entry.async('blob');
      var path = item.name.split('/').slice(0, -1).join('/');
      var fileName = item.name.split('/').pop();
      var imageFile = new File([blob], fileName, { type: guessMime(fileName) });
      addFile(imageFile, path);
    }

    showToast('Extracted ' + total + ' images from ' + file.name, 'success');
  } catch (err) {
    showToast('Failed to extract ZIP: ' + err.message, 'error');
  }

  overlay.classList.remove('active');
}

// ============================
// File Management
// ============================
function addFile(file, path) {
  var id = ++fileIdCounter;
  state.files.push({
    id: id, file: file, name: file.name, path: path,
    size: file.size, type: getExtension(file.name),
    thumb: null, status: 'pending', result: null
  });
  generateThumb(id, file);
}

function generateThumb(id, file) {
  var ext = getExtension(file.name);
  var skipThumb = ['heic', 'heif', 'cr2', 'nef', 'arw', 'dng', 'tiff', 'tif'];
  if (skipThumb.indexOf(ext) !== -1) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var entry = state.files.find(function(f) { return f.id === id; });
    if (entry) {
      entry.thumb = e.target.result;
      var thumbEl = document.querySelector('[data-id="' + id + '"] .fi-thumb img');
      if (thumbEl) thumbEl.src = e.target.result;
    }
  };
  reader.readAsDataURL(file.slice(0, 2 * 1024 * 1024));
}

function removeFile(id) {
  state.files = state.files.filter(function(f) { return f.id !== id; });
  updateUI();
}

// Make removeFile globally accessible for onclick
window.removeFile = removeFile;

function clearFiles() {
  state.files = [];
  state.results = [];
  state.totalOriginalSize = 0;
  state.totalConvertedSize = 0;
  resultsPanel.classList.add('hidden');
  batchProgress.classList.remove('active');
  updateUI();
}

// ============================
// UI Updates
// ============================
function updateUI() {
  var count = state.files.length;
  fileBadge.textContent = count + ' file' + (count !== 1 ? 's' : '');

  if (count > 0) {
    fileListEl.classList.remove('hidden');
    convertBtn.disabled = state.converting;
  } else {
    fileListEl.classList.add('hidden');
    convertBtn.disabled = true;
  }

  renderFileItems();
}

function renderFileItems() {
  var html = '';
  for (var i = 0; i < state.files.length; i++) {
    var f = state.files[i];
    var thumbHTML = f.thumb
      ? '<img src="' + f.thumb + '" alt="">'
      : '<i class="fa-solid fa-image"></i>';

    var statusIcon = '';
    if (f.status === 'pending') statusIcon = '<i class="fa-solid fa-clock"></i>';
    else if (f.status === 'processing') statusIcon = '<i class="fa-solid fa-spinner"></i>';
    else if (f.status === 'done') statusIcon = '<i class="fa-solid fa-check"></i>';
    else statusIcon = '<i class="fa-solid fa-exclamation"></i>';

    var pathHTML = f.path
      ? '<span class="fi-path" title="' + f.path + '">📁 ' + f.path + '</span>'
      : '';

    html += '<div class="file-item" data-id="' + f.id + '">'
      + '<div class="fi-thumb">' + thumbHTML + '</div>'
      + '<div class="fi-info">'
      + '  <div class="fi-name" title="' + (f.path ? f.path + '/' : '') + f.name + '">' + f.name + '</div>'
      + '  <div class="fi-meta">'
      + '    <span>' + f.type.toUpperCase() + '</span>'
      + '    <span>' + formatSize(f.size) + '</span>'
      + pathHTML
      + '  </div>'
      + '</div>'
      + '<div class="fi-status ' + f.status + '">' + statusIcon + '</div>'
      + '<button class="fi-remove" onclick="removeFile(' + f.id + ')" title="Remove">'
      + '  <i class="fa-solid fa-xmark"></i>'
      + '</button>'
      + '</div>';
  }
  fileItemsEl.innerHTML = html;
}

// ============================
// Quality UI
// ============================
function updateQualityLabel() {
  document.getElementById('qualityValue').textContent =
    document.getElementById('qualitySlider').value + '%';
}

function updateQualityVisibility() {
  var format = document.getElementById('outputFormat').value;
  document.getElementById('qualityGroup').style.display =
    (format === 'png' || format === 'gif') ? 'none' : 'block';
}

// ============================
// Conversion Engine
// ============================
async function startConversion() {
  if (state.converting || state.files.length === 0) return;

  state.converting = true;
  state.results = [];
  state.totalOriginalSize = 0;
  state.totalConvertedSize = 0;

  convertBtn.disabled = true;
  convertBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting...';
  batchProgress.classList.add('active');
  resultsPanel.classList.add('hidden');

  var outputFormat = document.getElementById('outputFormat').value;
  var quality = parseInt(document.getElementById('qualitySlider').value);
  var maxDim = parseInt(document.getElementById('maxDimension').value);
  var total = state.files.length;

  for (var i = 0; i < total; i++) {
    var f = state.files[i];
    f.status = 'processing';
    renderFileItems();
    bpFill.style.width = (i / total * 100) + '%';
    bpCount.textContent = (i + 1) + ' / ' + total;
    bpLabel.textContent = 'Converting ' + f.name + '...';

    // Small yield to let UI repaint
    await new Promise(function(r) { setTimeout(r, 10); });

    try {
      var result = await convertFile(f, outputFormat, quality, maxDim);
      f.status = 'done';
      state.totalOriginalSize += f.size;
      state.totalConvertedSize += result.size;

      var outName = f.name.replace(/\.[^.]+$/, '.' + outputFormat);

      state.results.push({
        id: f.id,
        name: outName,
        path: f.path,
        blob: result.blob,
        size: result.size,
        mimeType: result.mimeType,
        url: URL.createObjectURL(result.blob)
      });
    } catch (err) {
      console.error('Conversion error for ' + f.name + ':', err);
      f.status = 'error';
    }

    renderFileItems();
  }

  bpFill.style.width = '100%';
  bpLabel.textContent = 'Complete!';
  bpCount.textContent = total + ' / ' + total;

  showResults();

  state.converting = false;
  convertBtn.disabled = false;
  convertBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert All';

  var successCount = state.results.length;
  var failCount = total - successCount;
  if (failCount > 0) {
    showToast('Converted ' + successCount + ' files, ' + failCount + ' failed', 'error');
  } else {
    showToast('Successfully converted ' + successCount + ' files!', 'success');
  }
}

async function convertFile(fileEntry, outputFormat, quality, maxDim) {
  var ext = getExtension(fileEntry.name);
  var imageBitmap = null;

  // ---- HEIC / HEIF ----
  if (ext === 'heic' || ext === 'heif') {
    var heicBlob = await heic2any({
      blob: fileEntry.file,
      toType: 'image/png',
      quality: quality / 100
    });
    var resolved = Array.isArray(heicBlob) ? heicBlob[0] : heicBlob;
    imageBitmap = await createImageBitmap(resolved);
  }
  // ---- TIFF / DNG (TIFF-based RAW) ----
  else if (ext === 'tiff' || ext === 'tif' || ext === 'dng') {
    var buffer = await fileEntry.file.arrayBuffer();
    try {
      var ifds = UTIF.decode(buffer);
      if (ifds.length === 0) throw new Error('No IFDs found');
      UTIF.decodeImage(buffer, ifds[0]);
      var rgba = UTIF.toRGBA8(ifds[0]);
      var w = ifds[0].width;
      var h = ifds[0].height;

      var osc = new OffscreenCanvas(w, h);
      var octx = osc.getContext('2d');
      octx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
      var tempBlob = await osc.convertToBlob({ type: 'image/png' });
      imageBitmap = await createImageBitmap(tempBlob);
    } catch (utifErr) {
      // UTIF failed (e.g. compressed DNG) — try embedded JPEG preview
      console.warn('UTIF decode failed for ' + fileEntry.name + ', trying JPEG preview:', utifErr.message);
      imageBitmap = await extractDNGPreview(buffer, fileEntry.file);
    }
  }
  // ---- Other RAW formats (CR2, NEF, ARW) ----
  else if (ext === 'cr2' || ext === 'nef' || ext === 'arw') {
    // These contain embedded JPEG previews — try to extract
    var rawBuffer = await fileEntry.file.arrayBuffer();
    imageBitmap = await extractJPEGFromRaw(rawBuffer);
  }
  // ---- Standard browser-supported formats ----
  else {
    imageBitmap = await createImageBitmap(fileEntry.file);
  }

  // Calculate output dimensions
  var outW = imageBitmap.width;
  var outH = imageBitmap.height;

  if (maxDim > 0 && (outW > maxDim || outH > maxDim)) {
    var ratio = Math.min(maxDim / outW, maxDim / outH);
    outW = Math.round(outW * ratio);
    outH = Math.round(outH * ratio);
  }

  // Draw to canvas and export
  var canvas = new OffscreenCanvas(outW, outH);
  var ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, outW, outH);

  var mimeType;
  switch (outputFormat) {
    case 'jpg': case 'jpeg': mimeType = 'image/jpeg'; break;
    case 'webp': mimeType = 'image/webp'; break;
    case 'png': default: mimeType = 'image/png'; break;
  }

  var blob = await canvas.convertToBlob({
    type: mimeType,
    quality: quality / 100
  });

  imageBitmap.close();

  return { blob: blob, size: blob.size, mimeType: mimeType };
}

// ============================
// RAW / DNG Preview Extraction
// ============================

// Extract embedded JPEG from a DNG file
// DNG files store a full-size JPEG preview that we can find and decode
async function extractDNGPreview(buffer, originalFile) {
  // First try: scan for JPEG markers in the buffer
  var bitmap = await extractJPEGFromRaw(buffer);
  if (bitmap) return bitmap;

  // Last resort: try createImageBitmap directly (some browsers may support it)
  try {
    return await createImageBitmap(originalFile);
  } catch (e) {
    throw new Error('Cannot decode DNG: no JPEG preview found and browser cannot decode natively');
  }
}

// Scan a RAW file buffer for an embedded JPEG image
// RAW files (CR2, NEF, ARW, DNG) embed full-size JPEG previews
async function extractJPEGFromRaw(buffer) {
  var bytes = new Uint8Array(buffer);
  var jpegStart = -1;
  var jpegEnd = -1;
  var largestSize = 0;
  var largestStart = -1;
  var largestEnd = -1;

  // Find the LARGEST embedded JPEG (the full-res preview, not the thumbnail)
  for (var i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8) {
      // Found JPEG SOI marker
      jpegStart = i;
    } else if (bytes[i] === 0xFF && bytes[i + 1] === 0xD9 && jpegStart !== -1) {
      // Found JPEG EOI marker
      jpegEnd = i + 2;
      var size = jpegEnd - jpegStart;
      if (size > largestSize && size > 50000) { // skip tiny thumbnails (< 50KB)
        largestSize = size;
        largestStart = jpegStart;
        largestEnd = jpegEnd;
      }
      jpegStart = -1;
    }
  }

  if (largestStart !== -1 && largestEnd !== -1) {
    var jpegData = buffer.slice(largestStart, largestEnd);
    var jpegBlob = new Blob([jpegData], { type: 'image/jpeg' });
    try {
      return await createImageBitmap(jpegBlob);
    } catch (e) {
      // Corrupted JPEG data
    }
  }

  // Try createImageBitmap on the whole blob as last resort
  try {
    return await createImageBitmap(new Blob([buffer]));
  } catch (e) {
    throw new Error('No usable JPEG preview found in RAW file');
  }
}

function loadImage(url) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// ============================
// Results
// ============================
function showResults() {
  if (state.results.length === 0) return;

  resultsPanel.classList.remove('hidden');
  resultBadge.textContent = state.results.length + ' file' + (state.results.length !== 1 ? 's' : '');

  var html = '';
  for (var i = 0; i < state.results.length; i++) {
    var r = state.results[i];
    html += '<div class="file-item">'
      + '<div class="fi-thumb"><img src="' + r.url + '" alt=""></div>'
      + '<div class="fi-info">'
      + '  <div class="fi-name">' + r.name + '</div>'
      + '  <div class="fi-meta">'
      + '    <span>' + getExtension(r.name).toUpperCase() + '</span>'
      + '    <span>' + formatSize(r.size) + '</span>'
      + '  </div>'
      + '</div>'
      + '<div class="fi-status done"><i class="fa-solid fa-check"></i></div>'
      + '<button class="fi-remove" onclick="downloadSingle(\'' + r.id + '\')" title="Download" style="color:var(--acl)">'
      + '  <i class="fa-solid fa-download"></i>'
      + '</button>'
      + '</div>';
  }
  resultItemsEl.innerHTML = html;

  document.getElementById('statOriginal').textContent = formatSize(state.totalOriginalSize);
  document.getElementById('statConverted').textContent = formatSize(state.totalConvertedSize);
}

function downloadSingle(id) {
  var r = state.results.find(function(x) { return x.id == id; });
  if (!r) return;
  var a = document.createElement('a');
  a.href = r.url;
  a.download = r.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
window.downloadSingle = downloadSingle;

async function downloadAll() {
  if (state.results.length === 0) return;

  var btn = document.getElementById('downloadAllBtn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';
  btn.disabled = true;

  try {
    var zip = new JSZip();
    var preserveStructure = document.getElementById('preserveStructure').checked;

    for (var i = 0; i < state.results.length; i++) {
      var r = state.results[i];
      var filePath = preserveStructure && r.path ? r.path + '/' + r.name : r.name;
      zip.file(filePath, r.blob);
    }

    var zipBlob = await zip.generateAsync({ type: 'blob' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = 'converted-images.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    showToast('ZIP downloaded!', 'success');
  } catch (err) {
    showToast('ZIP creation failed: ' + err.message, 'error');
  }

  btn.innerHTML = '<i class="fa-solid fa-download"></i> Download All as ZIP';
  btn.disabled = false;
}

// ============================
// Toast
// ============================
function showToast(message, type) {
  type = type || 'success';
  var toast = document.getElementById('toast');
  toast.querySelector('span').textContent = message;
  toast.querySelector('i').className =
    type === 'success' ? 'fa-solid fa-check-circle' : 'fa-solid fa-exclamation-circle';
  toast.className = 'toast ' + type;
  requestAnimationFrame(function() {
    toast.classList.add('show');
  });
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, 3500);
}

// ============================
// Init
// ============================
updateQualityVisibility();
