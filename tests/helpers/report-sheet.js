const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the production Apps Script against an in-memory Sheets API.
module.exports = function reportSheet(file) {
  const sheets = new Map();
  const spreadsheet = {
    timezone: 'Etc/UTC',
    getSpreadsheetTimeZone() { return this.timezone; },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/report-test/edit',
    getSheets: () => [...sheets.values()],
    getSheetByName: name => sheets.get(name),
    insertSheet(name) {
      const grid = [], formulas = new Map(), formats = new Map();
      const sheet = {
        grid, formulas, formats, dropWrites: false, parseText: false, numericTextColumn: false, typedColumn: false, richTextWrites: [],
        getName: () => name, getSheetId: () => [...sheets.keys()].indexOf(name) + 1,
        getLastRow: () => grid.length, getLastColumn: () => grid[0]?.length || 0,
        getRange: (r,c,n,m) => ({
          getValues: () => Array.from({length:n}, (_,i) => Array.from({length:m}, (_,j) => grid[r-1+i]?.[c-1+j] ?? '')),
          getFormulas: () => Array.from({length:n}, (_,i) => Array.from({length:m}, (_,j) => formulas.get(`${r+i}:${c+j}`) || '')),
          setNumberFormat(format) {
            if (sheet.typedColumn) throw Error("Can't set the number format of cells in a typed column.");
            for(let i=0;i<n;i++)for(let j=0;j<m;j++)formats.set(`${r+i}:${c+j}`,format);
          },
          setRichTextValues(values) {
            sheet.richTextWrites.push({row:r,column:c,count:n});
            if (sheet.dropWrites) return;
            values.forEach((row,i) => { grid[r-1+i] ||= []; row.forEach((value,j) => {
              let text=value.getText();
              if(sheet.numericTextColumn && formats.get(`${r+i}:${c+j}`)!=='@' && /^\d+$/.test(text)) text=Number(text);
              grid[r-1+i][c-1+j] = text;
            }); });
          },
          setValues(values) {
            if (sheet.dropWrites) return;
            values.forEach((row,i) => { grid[r-1+i] ||= []; row.forEach((value,j) => {
              // Simulate typed Sheets cells normalizing decimal strings and
              // dates to whole seconds (the live verification regression).
              if (r+i > 1 && typeof value === 'string' && /^-?\d+\.\d+$/.test(value)) value = Number(value);
              if (sheet.parseText && r+i > 1 && typeof value === 'string') {
                if (/^\d{4}-\d{2}$/.test(value)) value = new Date(value+'-01T00:00:00Z');
                else if (/^\+?\d+$/.test(value)) value = Number(value);
              }
              if (Object.prototype.toString.call(value) === '[object Date]') value = new Date(Math.floor(value.getTime()/1000)*1000);
              grid[r-1+i][c-1+j] = value;
            }); });
          },
        }),
        deleteRow: r => grid.splice(r-1,1),
        copyTo: () => ({setName() {}}),
      };
      sheets.set(name,sheet);
      return sheet;
    },
  };
  const context = vm.createContext({
    SpreadsheetApp: {getActiveSpreadsheet: () => spreadsheet, flush() {}, newRichTextValue() {
      let text = '';
      return {setText(value) { text=value; return this; }, build: () => ({getText: () => text})};
    }},
    LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
    Utilities: {getUuid: () => 'test', formatDate(value,zone,format) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value).map(part => [part.type,part.value]));
      const day = `${parts.year}-${parts.month}-${parts.day}`;
      return format === 'yyyy-MM' ? day.slice(0,7) : format === 'yyyy-MM-dd' ? day : `${day} ${parts.hour}:${parts.minute}:${parts.second}`;
    }},
    formatSheet_() {}, formatReportSheet_() {}, writeAuditLog_() {},
    jsonResponse: (success,message,data) => ({success,message,data}),
  });
  const source = fs.readFileSync(path.join(__dirname,'../..',file),'utf8');
  vm.runInContext(source.slice(source.indexOf('function getDatabaseStructure()'),source.indexOf('function initializeDatabase()')),context);
  vm.runInContext(source.slice(source.indexOf('  function vendorReportIdentity_'),source.indexOf('  function writeAuditLog_')),context);
  return {context,sheets,spreadsheet};
};
