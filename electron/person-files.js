const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const electronApp = process.versions.electron ? require('electron').app : null;
const { httpResponseError, readJsonResponse } = require('./report-http');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const parse = (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch (_) { return fallback; } };
const safe = value => {
  const original = String(value || 'unknown');
  const clean = original.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || 'unknown';
  return clean === original && !/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean) ? clean : `${clean}-${digest(original).slice(0, 8)}`;
};
function persistentRoot(db, name) {
  if (electronApp?.isReady()) return path.join(electronApp.getPath('userData'), name);
  const directory = path.dirname(db.pool.file);
  return path.join(path.basename(directory) === 'database' ? path.dirname(directory) : directory, name);
}
function fileRoot(db) { return persistentRoot(db, 'media'); }
function legacyFileRoot(db) { return persistentRoot(db, 'files'); }
function within(root, file) {
  if (!file) throw new Error('Invalid local media path');
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.isAbsolute(file) ? path.resolve(file) : path.resolve(resolvedRoot, file);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Invalid local media path');
  }
  if (fs.existsSync(resolvedRoot)) {
    let existingPath = resolvedFile;
    while (!fs.existsSync(existingPath)) {
      const parent = path.dirname(existingPath);
      if (parent === existingPath) break;
      existingPath = parent;
    }
    const realRoot = fs.realpathSync(resolvedRoot);
    const realExistingPath = fs.realpathSync(existingPath);
    const realFile = path.resolve(realExistingPath, path.relative(existingPath, resolvedFile));
    const realRelative = path.relative(realRoot, realFile);
    if (!realRelative || realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
      throw new Error('Invalid local media path');
    }
  }
  return resolvedFile;
}
function withTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(
        new Error(`Google Drive request timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`),
        { code: 'REPORT_DRIVE_TIMEOUT' },
      ));
    }, timeoutMs);
  });
  return Promise.race([
    Promise.resolve().then(() => operation(controller.signal)),
    timeout,
  ]).finally(() => clearTimeout(timer));
}
function portablePath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}
function resolveStoredFile(db, storedPath) {
  for (const root of [fileRoot(db), legacyFileRoot(db)]) {
    try {
      const absolutePath = within(root, storedPath);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) return { root, absolutePath };
    } catch (error) {
      if (error.message !== 'Invalid local media path') throw error;
    }
  }
  return null;
}
function personMediaPath(table, identifier, type, fileHash, fileName) {
  return `${table.toLowerCase()}/${safe(identifier)}/${type === 'photo' ? 'photo' : 'documents'}/${fileHash}-${safe(fileName)}`;
}
function legacyDriveReference(person, row, mediaRows) {
  if (row.media_type === 'photo') return remoteReference(person.passport_photo);
  const documents = parse(person.documents, person.documents);
  const entries = Array.isArray(documents) ? documents : documents ? [documents] : [];
  const normalizedName = value => safe(value || '').toLowerCase();
  const matches = entries.filter(entry => {
    if (!entry || typeof entry !== 'object') return false;
    const name = entry.fileName || entry.file_name || entry.name;
    return name && normalizedName(name) === normalizedName(row.file_name);
  });
  if (matches.length === 1) return remoteReference(matches[0]);
  const missingDocumentRows = mediaRows.filter(item => item.media_type === 'document');
  if (entries.length === 1 && missingDocumentRows.length === 1) return remoteReference(entries[0]);
  return '';
}
function legacyDriveFileId(person, row, mediaRows) {
  const storedUrl = remoteReference(row.drive_url);
  const storedId = row.drive_file_id || storedUrl.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view/i)?.[1];
  if (storedId) return String(storedId);
  const reference = legacyDriveReference(person, row, mediaRows);
  return reference.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view/i)?.[1] || '';
}
function writeVerifiedFile(root, file, bytes, fileHash) {
  const absolutePath = within(root, file);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  try {
    fs.writeFileSync(absolutePath, bytes, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (digest(fs.readFileSync(absolutePath)) !== fileHash) throw new Error('Local file hash conflict');
  }
  return portablePath(root, absolutePath);
}
async function saveFile(db, table, entityId, type, media, identifier) {
  if (!['Students','Staff'].includes(table) || !['photo','document'].includes(type)) throw new Error('Invalid person media');
  const encoded = media?.base64 || media?.data;
  if (!encoded) return null;
  const bytes = Buffer.from(String(encoded).replace(/^data:[^,]*,/, ''), 'base64');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('File must contain data and be at most 20 MB');
  const fileHash = digest(bytes);
  const fileName = safe(media.fileName || media.name || (type === 'photo' ? 'photo' : 'document'));
  const [same] = await db.pool.query('SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id=? AND media_type=? AND file_name=? AND file_hash=? AND active=1', [table, entityId, type, fileName, fileHash]);
  const root = fileRoot(db);
  const filePath = path.join(root, table.toLowerCase(), safe(identifier || entityId), type === 'photo' ? 'photo' : 'documents', `${fileHash}-${fileName}`);
  if (same[0]) {
    let existingFile;
    try { existingFile = within(root, same[0].local_path); } catch (error) {
      if (error.message !== 'Invalid local media path') throw error;
    }
    if (existingFile && fs.existsSync(existingFile) && digest(fs.readFileSync(existingFile)) === fileHash) return descriptor(same[0]);
    const localPath = writeVerifiedFile(root, filePath, bytes, fileHash);
    await db.pool.query('UPDATE StudentMedia SET local_path=? WHERE id=?', [localPath, same[0].id]);
    return descriptor({ ...same[0], local_path: localPath });
  }
  const localPath = writeVerifiedFile(root, filePath, bytes, fileHash);
  // Replacing a photo never removes documents. Same-named documents with
  // different contents remain distinct active attachments.
  if (type === 'photo') await db.pool.query('UPDATE StudentMedia SET active=0 WHERE entity_table=? AND entity_id=? AND media_type=?', [table, entityId, type]);
  const row = { id:crypto.randomUUID(), entity_table:table, entity_id:entityId, media_type:type, file_name:fileName, mime_type:media.mimeType || 'application/octet-stream', total_chunks:0, created_at:new Date().toISOString(), local_path:localPath, file_hash:fileHash, upload_status:'LOCAL_ONLY', active:1 };
  const names = Object.keys(row);
  await db.pool.query(`INSERT INTO StudentMedia (${names.join(',')}) VALUES (${names.map(()=>'?').join(',')})`, Object.values(row));
  return descriptor(row);
}
function descriptor(row) { return { mediaId:row.id, fileName:row.file_name, mimeType:row.mime_type, localPath:row.local_path, fileHash:row.file_hash, driveFileId:row.drive_file_id || '', driveUrl:row.drive_url || '', driveFolderId:row.drive_folder_id || '', uploadStatus:row.upload_status }; }
async function stageFile(db, table, type, media, identifier) {
  if (!['Students','Staff'].includes(table) || !['photo','document'].includes(type)) throw new Error('Invalid person media');
  const saved = await saveFile(db, table, `staged-${crypto.randomUUID()}`, type, media, identifier || 'staged');
  await db.pool.query("UPDATE StudentMedia SET entity_id=?,upload_status='STAGED',active=0 WHERE id=?", [`staged:${saved.mediaId}`, saved.mediaId]);
  return saved;
}
async function adoptStagedFiles(db, table, entityId, identifier, ids) {
  const adopted = [];
  for (const idValue of [...new Set((Array.isArray(ids) ? ids : []).map(value => String(value || '').trim()).filter(Boolean))]) {
    const [rows] = await db.pool.query('SELECT * FROM StudentMedia WHERE id=? AND entity_table=? AND entity_id=? AND active=0 AND upload_status=? LIMIT 1', [idValue, table, `staged:${idValue}`, 'STAGED']);
    const row = rows[0];
    if (!row) throw new Error('A selected media file is no longer available. Select it again before saving.');
    const source = resolveStoredFile(db, row.local_path);
    if (!source || !row.file_hash || digest(fs.readFileSync(source.absolutePath)) !== row.file_hash) {
      throw new Error(`Staged media ${row.file_name} is missing or failed its integrity check. Select it again.`);
    }
    const target = path.join(fileRoot(db), personMediaPath(table, identifier || entityId, row.media_type, row.file_hash, row.file_name));
    const localPath = writeVerifiedFile(fileRoot(db), target, fs.readFileSync(source.absolutePath), row.file_hash);
    if (row.media_type === 'photo') {
      await db.pool.query('UPDATE StudentMedia SET active=0 WHERE entity_table=? AND entity_id=? AND media_type=? AND active=1', [table, entityId, 'photo']);
    }
    await db.pool.query("UPDATE StudentMedia SET entity_id=?,local_path=?,upload_status='LOCAL_ONLY',drive_file_id=NULL,drive_url=NULL,drive_folder_id=NULL,uploaded_hash=NULL,last_upload_date=NULL,active=1 WHERE id=?", [entityId, localPath, row.id]);
    adopted.push(descriptor({ ...row, entity_id: entityId, local_path: localPath, upload_status: 'LOCAL_ONLY', drive_file_id: null, drive_url: null, drive_folder_id: null, active: 1 }));
  }
  return adopted;
}
async function repairFile(db, mediaId, media) {
  const [rows] = await db.pool.query('SELECT * FROM StudentMedia WHERE id=? AND active=1 LIMIT 1', [String(mediaId || '')]);
  const row = rows[0];
  if (!row || !['Students','Staff'].includes(row.entity_table)) throw new Error('The missing media record was not found.');
  const [people] = await db.pool.query(`SELECT * FROM ${row.entity_table} WHERE id=? LIMIT 1`, [row.entity_id]);
  if (!people[0]) throw new Error('The person associated with this media record was not found.');
  const identifier = row.entity_table === 'Students' ? people[0].registration_number : people[0].employee_id;
  const encoded = media?.base64 || media?.data;
  const bytes = Buffer.from(String(encoded || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('The selected file must contain data and be at most 20 MB.');
  const fileHash = digest(bytes);
  const fileName = safe(media.fileName || media.name || row.file_name);
  const target = path.join(fileRoot(db), personMediaPath(row.entity_table, identifier || row.entity_id, row.media_type, fileHash, fileName));
  const localPath = writeVerifiedFile(fileRoot(db), target, bytes, fileHash);
  await db.pool.query("UPDATE StudentMedia SET file_name=?,mime_type=?,local_path=?,file_hash=?,uploaded_hash=NULL,drive_file_id=NULL,drive_url=NULL,drive_folder_id=NULL,upload_status='LOCAL_ONLY',last_upload_date=NULL WHERE id=?", [fileName, media.mimeType || 'application/octet-stream', localPath, fileHash, row.id]);
  return descriptor({ ...row, file_name: fileName, mime_type: media.mimeType || 'application/octet-stream', local_path: localPath, file_hash: fileHash, uploaded_hash: null, drive_file_id: null, drive_url: null, drive_folder_id: null, upload_status: 'LOCAL_ONLY' });
}
async function missingMedia(db) {
  const [rows] = await db.pool.query(`SELECT m.*, p.full_name, p.registration_number, NULL AS employee_id
    FROM StudentMedia m JOIN Students p ON m.entity_table='Students' AND p.id=m.entity_id
    WHERE m.active=1
    UNION ALL
    SELECT m.*, p.full_name, NULL AS registration_number, p.employee_id
    FROM StudentMedia m JOIN Staff p ON m.entity_table='Staff' AND p.id=m.entity_id
    WHERE m.active=1
    ORDER BY entity_table, entity_id, media_type, file_name`);
  const result = [];
  for (const row of rows) {
    const confirmedDriveCopy = confirmedDriveUrl(row) && row.file_hash && row.uploaded_hash === row.file_hash;
    if (confirmedDriveCopy) continue;
    const local = resolveStoredFile(db, row.local_path);
    if (local && row.file_hash && digest(fs.readFileSync(local.absolutePath)) === row.file_hash) continue;
    const recovered = await materialize(db, row);
    const recoveredLocal = resolveStoredFile(db, recovered.local_path);
    if (recoveredLocal && recovered.file_hash && digest(fs.readFileSync(recoveredLocal.absolutePath)) === recovered.file_hash) continue;
    result.push({
      mediaId: row.id,
      entityTable: row.entity_table,
      personId: row.entity_table === 'Students' ? row.registration_number : row.employee_id,
      personName: row.full_name || '',
      mediaType: row.media_type,
      fileName: row.file_name || '',
    });
  }
  return result;
}
async function validateMedia(db) {
  const [counts] = await db.pool.query('SELECT COUNT(*) AS total FROM StudentMedia WHERE active=1');
  const items = await missingMedia(db);
  const total = Number(counts[0]?.total || 0);
  return { ready: Math.max(total - items.length, 0), missing: items.length, total, items };
}
async function materialize(db, row) {
  const root = fileRoot(db);
  if (row.local_path) {
    const stored = resolveStoredFile(db, row.local_path);
    if (stored) {
      const bytes = fs.readFileSync(stored.absolutePath);
      const fileHash = digest(bytes);
      if (row.file_hash && fileHash !== row.file_hash) {
        if (path.isAbsolute(row.local_path)) {
          await db.pool.query('UPDATE StudentMedia SET local_path=NULL WHERE id=?', [row.id]);
          row = { ...row, local_path: null };
        } else {
          return row;
        }
      }
      if (stored.root === root && portablePath(root, stored.absolutePath) === row.local_path) {
        if (!row.file_hash) {
          await db.pool.query('UPDATE StudentMedia SET file_hash=? WHERE id=?', [fileHash, row.id]);
          return { ...row, file_hash: fileHash };
        }
        return row;
      }
      const [people] = await db.pool.query(`SELECT * FROM ${row.entity_table === 'Students' ? 'Students' : 'Staff'} WHERE id=?`, [row.entity_id]);
      const person = people[0] || {};
      const identifier = person.registration_number || person.employee_id || row.entity_id;
      const target = path.join(root, personMediaPath(row.entity_table, identifier, row.media_type, fileHash, row.file_name));
      const localPath = writeVerifiedFile(root, target, bytes, fileHash);
      await db.pool.query('UPDATE StudentMedia SET local_path=?,file_hash=? WHERE id=?', [localPath, fileHash, row.id]);
      return { ...row, local_path: localPath, file_hash: fileHash };
    }
    // Never retain a machine-specific absolute source path in the synced row.
    // Its Drive metadata and file hash remain available for recovery.
    if (path.isAbsolute(row.local_path)) {
      await db.pool.query('UPDATE StudentMedia SET local_path=NULL WHERE id=?', [row.id]);
      row = { ...row, local_path: null };
    }
  }
  const [chunks] = await db.pool.query('SELECT chunk_data FROM StudentMediaChunks WHERE media_id=? ORDER BY chunk_index', [row.id]);
  // Local paths are machine-specific and may point to another PC's files.
  // A Drive URL is still usable even when this replica has no local copy.
  const [people] = await db.pool.query(`SELECT * FROM ${row.entity_table === 'Students' ? 'Students' : 'Staff'} WHERE id=?`, [row.entity_id]);
  const person = people[0] || {};
  if (!chunks.length) {
    // Recover copied files without trusting another installation's absolute path.
    if (/^[a-f0-9]{64}$/i.test(row.file_hash || '')) {
      const candidate = within(root, path.join(root, personMediaPath(row.entity_table, person.registration_number || person.employee_id || row.entity_id, row.media_type, row.file_hash, row.file_name)));
      if (fs.existsSync(candidate) && digest(fs.readFileSync(candidate)) === row.file_hash) {
        const localPath = portablePath(root, candidate);
        await db.pool.query('UPDATE StudentMedia SET local_path=? WHERE id=?', [localPath, row.id]);
        return {...row, local_path:localPath};
      }
    }
    return row;
  }
  const bytes = Buffer.from(chunks.map(chunk=>chunk.chunk_data).join(''), 'base64');
  const fileHash = digest(bytes);
  const absolutePath = within(root, path.join(root, personMediaPath(row.entity_table, person.registration_number || person.employee_id || row.entity_id, row.media_type, fileHash, row.file_name)));
  const localPath = portablePath(root, absolutePath);
  writeVerifiedFile(root, absolutePath, bytes, fileHash);
  await db.pool.query('UPDATE StudentMedia SET local_path=?, file_hash=? WHERE id=?', [localPath, fileHash, row.id]);
  return {...row, local_path:localPath, file_hash:fileHash};
}
async function activeMedia(db, table, entityId) {
  const [rows] = await db.pool.query('SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id=? AND active=1 ORDER BY created_at,id', [table,entityId]);
  return Promise.all(rows.map(row=>materialize(db,row)));
}
async function hydrate(db, table, person) {
  const rows = await activeMedia(db, table, person.id);
  if (!rows.length) return person;
  const value = row => {
    const result = descriptor(row);
    const local = resolveStoredFile(db, row.local_path);
    if (local && (!row.file_hash || digest(fs.readFileSync(local.absolutePath)) === row.file_hash)) {
      result.base64 = fs.readFileSync(local.absolutePath).toString('base64');
    }
    return result;
  };
  return {...person, passport_photo:rows.some(row=>row.media_type==='photo') ? value(rows.find(row=>row.media_type==='photo')) : person.passport_photo,
    documents:rows.some(row=>row.media_type==='document') ? rows.filter(row=>row.media_type==='document').map(value) : person.documents};
}
async function validateReportMedia(db, table, people) {
  const missing = [];
  const readyPeople = new Set();
  for (const person of people) {
    const identifier = table === 'Students' ? person.registration_number : person.employee_id;
    const rows = await activeMedia(db, table, person.id);
    let hasMissing = false;
    for (const row of rows) {
      const local = resolveStoredFile(db, row.local_path);
      const localBytesValid = local && row.file_hash && digest(fs.readFileSync(local.absolutePath)) === row.file_hash;
      const driveBytesValid = confirmedDriveUrl(row) && row.file_hash && row.uploaded_hash === row.file_hash;
      const legacyDriveValid = Boolean(legacyDriveFileId(person, row, rows));
      if (localBytesValid || driveBytesValid || legacyDriveValid) continue;
      missing.push(`${identifier} / ${row.file_name}`);
      hasMissing = true;
    }
    if (!hasMissing) readyPeople.add(String(person.id));
  }
  return { readyRecords: readyPeople.size, missingCount: missing.length, missingMedia: missing };
}
async function prepareReports(db, table, people, endpoint, sessionToken, onProgress = () => {}) {
  const postDrive = async (payload, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;
    while (Date.now() < deadline) {
      attempt += 1;
      const remainingMs = deadline - Date.now();
      const { response, body } = await withTimeout(async signal => {
        const response = await fetch(endpoint, {
          method:'POST',
          redirect:'follow',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          signal,
          body:JSON.stringify(payload),
        });
        return { response, body: await readJsonResponse(response, endpoint, 'Drive upload') };
      }, remainingMs);
      if (!response.ok) throw httpResponseError(response, endpoint, body, 'Drive upload');
      if (!body.success) {
        const code = body.data?.error || body.error || body.code;
        if (code === 'DRIVE_BUSY' && attempt < 8 && Date.now() < deadline) {
          const retryDelay = Math.min(
            Math.max(Number(body.data?.retryAfterMs) || 1000, 250),
            5000,
            deadline - Date.now(),
          );
          if (retryDelay > 0) await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        if (code === 'ACCESS_DENIED' || code === 'REPORT_AUTH_REQUIRED') {
          throw Object.assign(new Error(body.data?.message || body.message || 'Google reporting session was rejected. Reopen Reports and sign in again.'), { code });
        }
        if (code === 'DRIVE_BUSY') {
          throw Object.assign(new Error(body.data?.message || body.message || 'Google Drive is busy. Retry this report shortly.'), { code });
        }
        throw Object.assign(
          new Error(body.data?.message || body.message || 'Google Drive request failed.'),
          code ? { code } : {},
        );
      }
      return body;
    }
    throw Object.assign(new Error(`Google Drive remained busy after ${attempt} attempts. Retry this report shortly.`), { code: 'DRIVE_BUSY' });
  };
  const result = [];
  const unavailable = [];
  for (const person of people) {
    const identifier = table === 'Students' ? person.registration_number : person.employee_id;
    const folderColumn = table === 'Students' ? 'student_folder' : 'staff_folder';
    let folder = person[folderColumn] || '';
    let rows = await activeMedia(db, table, person.id);
    // Older Staff saves kept {name,mimeType,data} directly on the person.
    // Move embedded attachments into the shared file pipeline before deciding
    // this is a folder-only report. Existing indexed files remain authoritative.
    const embedded = value => {
      const parsed = parse(value, null);
      if (parsed && typeof parsed === 'object' && (parsed.base64 || parsed.data)) return parsed;
      if (typeof value === 'string' && /^data:[^,]+;base64,/.test(value)) {
        return { base64:value, mimeType:value.slice(5,value.indexOf(';')) };
      }
      return null;
    };
    const legacyPhoto = embedded(person.passport_photo);
    const legacyDocuments = parse(person.documents, []);
    let recovered = false;
    if (!rows.some(row=>row.media_type==='photo') && legacyPhoto) {
      await saveFile(db, table, person.id, 'photo', legacyPhoto, identifier);
      recovered = true;
    }
    if (Array.isArray(legacyDocuments)) {
      for (const document of legacyDocuments) {
        const media = embedded(document);
        if (media && !rows.some(row=>row.media_type==='document' && row.file_name===safe(media.fileName || media.name || 'document'))) {
          await saveFile(db, table, person.id, 'document', media, identifier);
          recovered = true;
        }
      }
    }
    if (recovered) rows = await activeMedia(db, table, person.id);
    if (!folder) folder = rows.find(row => row.drive_folder_id)?.drive_folder_id || '';
    const files = [];
    const uploads = [];
    const personMissing = [];
    for (let row of rows) {
      let bytes;
      if (row.local_path) {
        const local = resolveStoredFile(db, row.local_path);
        if (local) {
          const candidate = fs.readFileSync(local.absolutePath);
          if (row.file_hash && digest(candidate) === row.file_hash) bytes = candidate;
        }
      }
      // A synced replica may not have the source computer's local file. Reuse
      // a previously confirmed Drive copy when its stored hash matches; legacy
      // imports do not always have drive_folder_id populated.
      const confirmedUrl = confirmedDriveUrl(row);
      const hasConfirmedDriveCopy = confirmedUrl && row.file_hash && row.uploaded_hash === row.file_hash;
      if (!bytes && hasConfirmedDriveCopy) {
        files.push({fileName:row.file_name, documentType:row.media_type, driveFileId:row.drive_file_id || '', url:confirmedUrl});
        continue;
      }
      if (!bytes) {
        const legacyFileId = legacyDriveFileId(person, row, rows);
        if (legacyFileId) {
          try {
            onProgress({ stage: 'recovering', detail: `${identifier} / ${row.file_name}` });
            const recovered = await postDrive({action:'readPersonFile',sessionToken,entity:table,fileId:legacyFileId},90000);
            const encoded = String(recovered.data?.base64 || '');
            if (!encoded || encoded.length > 28_000_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
              throw Object.assign(new Error('Drive returned invalid file data.'), { code: 'PERSON_MEDIA_UNAVAILABLE' });
            }
            const bytesFromDrive = Buffer.from(encoded, 'base64');
            if (!bytesFromDrive.length || bytesFromDrive.length > 20 * 1024 * 1024 ||
                (row.file_hash && digest(bytesFromDrive) !== row.file_hash)) {
              throw Object.assign(new Error('The Drive file does not match the stored media hash.'), { code: 'PERSON_MEDIA_UNAVAILABLE' });
            }
            const fileHash = digest(bytesFromDrive);
            const filePath = path.join(fileRoot(db), personMediaPath(table, identifier || person.id, row.media_type, fileHash, row.file_name));
            const localPath = writeVerifiedFile(fileRoot(db), filePath, bytesFromDrive, fileHash);
            const driveUrl = driveFileUrl(legacyFileId);
            await db.pool.query(
              "UPDATE StudentMedia SET local_path=?,file_hash=?,mime_type=?,drive_file_id=?,drive_url=?,uploaded_hash=?,upload_status='UPLOADED_TO_DRIVE',last_upload_date=? WHERE id=?",
              [localPath,fileHash,recovered.data.mimeType || row.mime_type || 'application/octet-stream',legacyFileId,driveUrl,fileHash,new Date().toISOString(),row.id],
            );
            files.push({fileName:row.file_name,documentType:row.media_type,driveFileId:legacyFileId,url:driveUrl});
            continue;
          } catch (error) {
            if (error.code === 'REPORT_AUTH_REQUIRED' || error.code === 'ACCESS_DENIED') throw error;
            if (!['PERSON_MEDIA_UNAVAILABLE','REPORT_HTTP_404'].includes(error.code)) throw new Error(
              `Could not recover ${identifier} / ${row.file_name} from its existing Drive file: ${error.message}`,
              { cause:error, code:error.code },
            );
          }
        }
      }
      if (!bytes) {
        personMissing.push(`${identifier} / ${row.file_name}`);
        continue;
      }
      const fileHash = digest(bytes);
      if (confirmedUrl && row.uploaded_hash === fileHash &&
          (!row.file_hash || row.file_hash === fileHash)) {
        files.push({fileName:row.file_name, documentType:row.media_type, driveFileId:row.drive_file_id, url:confirmedUrl});
      } else {
        uploads.push({ row, bytes, fileHash });
      }
    }
    if (personMissing.length) {
      unavailable.push(...personMissing);
      continue;
    }
    for (const { row: originalRow, bytes, fileHash } of uploads) {
      const row = originalRow;
      try {
        onProgress({ stage: 'folders', detail: `Preparing the Drive folder for ${identifier}.` });
        onProgress({ stage: row.media_type === 'photo' ? 'photos' : 'documents', detail: `${identifier} / ${row.file_name}` });
        await db.pool.query("UPDATE StudentMedia SET upload_status='PENDING_UPLOAD' WHERE id=?", [row.id]);
        const body = await postDrive({action:'uploadPersonFile', sessionToken, entity:table, identifier, fullName:person.full_name, folderId:folder, fileName:row.file_name, mimeType:row.mime_type, mediaType:row.media_type, fileHash, base64:bytes.toString('base64')},180000);
        if (!body.data?.fileId || !body.data?.folderId || body.data.fileHash !== fileHash) throw new Error('Drive did not confirm the file hash and IDs');
        folder = body.data.folderId;
        const driveUrl = body.data.url || driveFileUrl(body.data.fileId);
        if (!/^https:\/\/drive\.google\.com\/file\/d\/[^/]+\/view(?:[?#]|$)/i.test(driveUrl)) throw new Error('Drive returned an invalid file URL');
        await db.pool.transaction(async()=>{
          await db.pool.query(`UPDATE ${table} SET ${folderColumn}=? WHERE id=?`, [folder, person.id]);
          await db.pool.query("UPDATE StudentMedia SET drive_file_id=?,drive_url=?,drive_folder_id=?,file_hash=?,uploaded_hash=?,upload_status='UPLOADED_TO_DRIVE',last_upload_date=? WHERE id=?",[body.data.fileId,driveUrl,folder,fileHash,fileHash,new Date().toISOString(),row.id]);
        });
        files.push({fileName:row.file_name, documentType:row.media_type, driveFileId:body.data.fileId, url:driveUrl});
      } catch(error) {
        const outcomeUncertain = error.code === 'REPORT_DRIVE_TIMEOUT' ||
          /fetch failed|network|aborted|timed out/i.test(String(error.message));
        if (!outcomeUncertain) await db.pool.query("UPDATE StudentMedia SET upload_status='UPLOAD_FAILED' WHERE id=?",[row.id]);
        throw Object.assign(new Error(`Upload failed for ${identifier} / ${row.file_name}: ${error.message}. The file remains local; retry this report.`), { code: error.code });
      }
    }
    const photo = files.find(file=>file.documentType==='photo');
    const documents = files.filter(file=>file.documentType==='document');
    const report = db.reportRow(person);
    // Do not fall back to raw legacy base64 or disk paths in a Sheets payload.
    report['Passport Size Photo'] = photo ? photo.url : remoteReference(person.passport_photo);
    // Sheets cells contain links only; keep filenames, hashes and IDs locally.
    report.Documents = documentLinks(documents.length ? documents : person.documents);
    report[table==='Students'?'Student Drive Folder':'Employee Drive Folder'] = folder;
    result.push(report);
  }
  return { rows: result, missingMedia: unavailable, readyRecords: result.length, missingCount: unavailable.length };
}
function driveFileUrl(fileId) { const id=String(fileId||'').trim(); return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view?usp=drivesdk` : ''; }
function confirmedDriveUrl(row) {
  const id = String(row.drive_file_id || '').trim();
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return '';
  try {
    const url = new URL(String(row.drive_url || driveFileUrl(id)));
    const fileId = url.pathname.match(/^\/file\/d\/([^/]+)\/view\/?$/i)?.[1];
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'drive.google.com' &&
      fileId && decodeURIComponent(fileId) === id ? url.href : '';
  } catch (_) {
    return '';
  }
}
function remoteReference(value) {
  const parsed=parse(value,null);
  const candidate=typeof parsed==='string' ? parsed :
    typeof value==='string' ? value : parsed?.driveUrl || parsed?.url || '';
  const idFromUrl=String(candidate).match(/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?#]+)/i)?.[1];
  const objectId = parsed?.driveFileId || parsed?.fileId ||
    (/^[\w-]{20,}$/.test(String(parsed?.id || '')) ? parsed.id : '');
  const id=idFromUrl || objectId;
  return id ? driveFileUrl(id) : '';
}
function documentLinks(value) {
  const links = new Set();
  const collect = item => {
    const parsed = parse(item, item);
    if (Array.isArray(parsed)) { parsed.forEach(collect); return; }
    const references = typeof parsed === 'string' ? parsed.split(/\r?\n/) : [parsed];
    for (const reference of references) {
      const url = remoteReference(typeof reference === 'string' ? reference.trim() : reference);
      if (/^https:\/\/drive\.google\.com\/[^\s<>"'\\]+$/i.test(url)) links.add(url);
    }
  };
  collect(value);
  return [...links].join('\n');
}
module.exports={saveFile,stageFile,adoptStagedFiles,repairFile,missingMedia,validateMedia,validateReportMedia,hydrate,activeMedia,materialize,prepareReports,fileRoot,legacyFileRoot,resolveStoredFile,within,withTimeout,parse,digest,descriptor,documentLinks};
