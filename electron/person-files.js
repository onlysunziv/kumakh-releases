const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const parse = (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch (_) { return fallback; } };
const safe = value => {
  const original = String(value || 'unknown');
  const clean = original.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || 'unknown';
  return clean === original && !/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean) ? clean : `${clean}-${digest(original).slice(0, 8)}`;
};
function fileRoot(db) { const directory=path.dirname(db.pool.file);return path.join(path.basename(directory)==='database'?path.dirname(directory):directory, 'files'); }
function within(root, file) {
  const relative = path.relative(root, path.resolve(file));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid local media path');
  return path.resolve(file);
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
  if (same[0]) return descriptor(same[0]);
  const localPath = within(fileRoot(db), path.join(fileRoot(db), table.toLowerCase(), safe(identifier || entityId), type === 'photo' ? 'photo' : 'documents', `${fileHash}-${fileName}`));
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  try { fs.writeFileSync(localPath, bytes, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; if (digest(fs.readFileSync(localPath)) !== fileHash) throw new Error('Local file hash conflict'); }
  // Replacing a photo never removes documents. Prior files are retained on disk.
  await db.pool.query('UPDATE StudentMedia SET active=0 WHERE entity_table=? AND entity_id=? AND media_type=?' + (type === 'document' ? ' AND file_name=?' : ''), [table, entityId, type, ...(type === 'document' ? [fileName] : [])]);
  const row = { id:crypto.randomUUID(), entity_table:table, entity_id:entityId, media_type:type, file_name:fileName, mime_type:media.mimeType || 'application/octet-stream', total_chunks:0, created_at:new Date().toISOString(), local_path:localPath, file_hash:fileHash, upload_status:'LOCAL_ONLY', active:1 };
  const names = Object.keys(row);
  await db.pool.query(`INSERT INTO StudentMedia (${names.join(',')}) VALUES (${names.map(()=>'?').join(',')})`, Object.values(row));
  return descriptor(row);
}
function descriptor(row) { return { mediaId:row.id, fileName:row.file_name, mimeType:row.mime_type, localPath:row.local_path, fileHash:row.file_hash, driveFileId:row.drive_file_id || '', driveUrl:row.drive_url || '', driveFolderId:row.drive_folder_id || '', uploadStatus:row.upload_status }; }
async function materialize(db, row) {
  const root = fileRoot(db);
  if (row.local_path) {
    try {
      if (fs.existsSync(within(root, row.local_path))) return row;
    } catch (error) {
      if (error.message !== 'Invalid local media path') throw error;
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
      const candidate = within(root, path.join(root, row.entity_table.toLowerCase(), safe(person.registration_number || person.employee_id || row.entity_id), row.media_type === 'photo' ? 'photo' : 'documents', `${row.file_hash}-${safe(row.file_name)}`));
      if (fs.existsSync(candidate) && digest(fs.readFileSync(candidate)) === row.file_hash) {
        await db.pool.query('UPDATE StudentMedia SET local_path=? WHERE id=?', [candidate, row.id]);
        return {...row, local_path:candidate};
      }
    }
    return row;
  }
  const bytes = Buffer.from(chunks.map(chunk=>chunk.chunk_data).join(''), 'base64');
  const fileHash = digest(bytes);
  const localPath = within(root, path.join(root, row.entity_table.toLowerCase(), safe(person.registration_number || person.employee_id || row.entity_id), row.media_type === 'photo' ? 'photo' : 'documents', `${fileHash}-${safe(row.file_name)}`));
  fs.mkdirSync(path.dirname(localPath), {recursive:true});
  if (!fs.existsSync(localPath)) fs.writeFileSync(localPath, bytes, {flag:'wx'});
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
    try {
      if (row.local_path) {
        const localPath = within(fileRoot(db), row.local_path);
        if (fs.existsSync(localPath)) result.base64 = fs.readFileSync(localPath).toString('base64');
      }
    } catch (error) {
      if (error.message !== 'Invalid local media path') throw error;
    }
    return result;
  };
  return {...person, passport_photo:rows.some(row=>row.media_type==='photo') ? value(rows.find(row=>row.media_type==='photo')) : person.passport_photo,
    documents:rows.some(row=>row.media_type==='document') ? rows.filter(row=>row.media_type==='document').map(value) : person.documents};
}
async function prepareReports(db, table, people, endpoint, sessionToken, onProgress = () => {}) {
  const readResponse = async response => {
    const raw = typeof response.text === 'function' ? await response.text() : null;
    if (raw !== null) {
      try { return JSON.parse(raw); }
      catch (_) {
        const detail = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
        throw new Error(`Reports endpoint returned non-JSON response (${response.status || 'unknown'}): ${detail || 'empty response'}`);
      }
    }
    return response.json();
  };
  const postDrive = async (payload, timeoutMs) => {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(endpoint, {method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify(payload)});
        const body = await readResponse(response);
        if (!response.ok || !body.success) {
          const code = body.data?.error || body.error || body.code;
          if (code === 'ACCESS_DENIED' || code === 'REPORT_AUTH_REQUIRED') {
            throw Object.assign(new Error(body.data?.message || body.message || 'Google reporting session was rejected. Reopen Reports and sign in again.'), { code });
          }
          throw new Error(body.message || body.data?.message || 'Google Drive upload failed');
        }
        return body;
      } catch (error) {
        lastError = error;
        if (attempt < 2 && /timeout|aborted|fetch failed|network/i.test(String(error.message))) continue;
        throw lastError;
      }
    }
    throw lastError;
  };
  const result = [];
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
    {
      onProgress({ stage: 'folders', detail: 'Preparing a Drive folder for ' + identifier + '.' });
      const body=await postDrive({action:'uploadPersonFile',sessionToken,entity:table,identifier,fullName:person.full_name,folderId:folder,folderOnly:true},90000);
      if(!body.data?.folderId || !body.data.photoFolderId || !body.data.documentsFolderId)throw new Error('Drive did not confirm the Photo and Documents subfolders. Update the Apps Script deployment with the latest code.gs and retry.');
      folder=body.data.folderId;
      await db.pool.query(`UPDATE ${table} SET ${folderColumn}=? WHERE id=?`,[folder,person.id]);
    }
    const files = [];
    for (let row of rows) {
      let bytes;
      if (row.local_path) {
        try {
          const localPath = within(fileRoot(db), row.local_path);
          if (fs.existsSync(localPath)) bytes = fs.readFileSync(localPath);
        } catch (error) {
          if (error.message !== 'Invalid local media path') throw error;
        }
      }
      // A local_path belongs to the computer that uploaded the file. When a
      // synced Turso record already has a Drive URL, use that shared reference
      // instead of trying to read another computer's filesystem.
      if (!bytes && row.drive_folder_id === folder && (row.drive_url || row.drive_file_id)) {
        files.push({fileName:row.file_name, documentType:row.media_type, driveFileId:row.drive_file_id || '', url:row.drive_url || driveFileUrl(row.drive_file_id)});
        continue;
      }
      if (!bytes) {
        throw new Error(`Media file is unavailable for ${identifier} / ${row.file_name}. Open the original PC or upload the file again.`);
      }
      const fileHash = digest(bytes);
      if (!(row.drive_file_id && row.uploaded_hash === fileHash && row.drive_folder_id === folder)) {
        await db.pool.query("UPDATE StudentMedia SET upload_status='PENDING_UPLOAD' WHERE id=?", [row.id]);
        try {
          onProgress({ stage: row.media_type === 'photo' ? 'photos' : 'documents', detail: row.file_name });
          const body = await postDrive({action:'uploadPersonFile', sessionToken, entity:table, identifier, fullName:person.full_name, folderId:folder, fileName:row.file_name, mimeType:row.mime_type, mediaType:row.media_type, fileHash, base64:bytes.toString('base64')},180000);
          if (!body.data?.fileId || !body.data?.folderId || body.data.fileHash !== fileHash) throw new Error('Drive did not confirm the file hash and IDs');
          folder = body.data.folderId;
          await db.pool.transaction(async()=>{
            await db.pool.query(`UPDATE ${table} SET ${folderColumn}=? WHERE id=?`, [folder, person.id]);
            await db.pool.query("UPDATE StudentMedia SET drive_file_id=?,drive_url=?,drive_folder_id=?,file_hash=?,uploaded_hash=?,upload_status='UPLOADED_TO_DRIVE',last_upload_date=? WHERE id=?",[body.data.fileId,body.data.url,folder,fileHash,fileHash,new Date().toISOString(),row.id]);
          });
          row={...row,drive_file_id:body.data.fileId,drive_url:body.data.url,drive_folder_id:folder};
        } catch(error) { await db.pool.query("UPDATE StudentMedia SET upload_status='UPLOAD_FAILED' WHERE id=?",[row.id]); throw Object.assign(new Error(`Upload failed for ${identifier} / ${row.file_name}: ${error.message}. Local files are safe; retry this report.`), { code: error.code }); }
      }
      files.push({
        fileName: row.file_name,
        documentType: row.media_type,
        driveFileId: row.drive_file_id,
        url: remoteReference({ driveFileId: row.drive_file_id, url: row.drive_url }),
      });
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
  return result;
}
function driveFileUrl(fileId) { const id=String(fileId||'').trim(); return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view?usp=drivesdk` : ''; }
function remoteReference(value) {
  const parsed=parse(value,null);
  const candidate=typeof value==='string' ? value : parsed?.driveUrl || parsed?.url || '';
  const idFromUrl=String(candidate).match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?#]+)/i)?.[1];
  const id=idFromUrl || parsed?.driveFileId || parsed?.fileId || parsed?.id;
  if (id) return driveFileUrl(id);
  return /^https:\/\//.test(candidate) ? candidate : '';
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
module.exports={saveFile,hydrate,activeMedia,materialize,prepareReports,fileRoot,within,parse,digest,descriptor,documentLinks};
