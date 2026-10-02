# Student and Staff media storage

Student and Staff media belongs to the Electron user's persistent `userData` directory, not the replaceable application installation. The SQLite replica is stored under `userData/database`; media is stored in the sibling `userData/media` directory. New SQLite `StudentMedia.local_path` values are portable paths relative to that media directory, such as `students/<registration-id>/photo/...` and `staff/<employee-id>/documents/...`.

File selection copies bytes through the Electron main-process database bridge immediately. The person form later adopts the staged media rows into the saved person record. Generated names include the file content hash, so different files with the same original filename do not overwrite each other. The renderer never receives filesystem access.

The centralized media resolver accepts only paths contained by the current persistent media root or the legacy `userData/files` root. Valid legacy files are copied into `userData/media` and their SQLite paths are updated. Absolute paths that point outside those roots are not followed; stale machine-specific paths are cleared without removing the media row, its hash, or any Drive reference.

Report submission first checks local file hashes and confirmed Drive references. Available media is uploaded to the appropriate Google Drive folder, and the report includes a Drive URL only after Drive confirms the file ID, URL, and content hash. Records with missing media are excluded from the successful report rows and reported separately. The Reports page's Missing Media repair section lets an operator reselect a file; the replacement is copied into persistent storage and its media row is updated.

The SQLite audit found repeated `dup.*` names and source-PC absolute paths that do not exist on the audited PC, but did not establish that those contents are placeholders or test data. Those media rows are intentionally retained; no records were nulled or deleted.
