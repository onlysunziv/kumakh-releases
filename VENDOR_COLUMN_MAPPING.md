# Vendor Column Mapping - Complete Flow

## Database Schema

### VENDOR_HEADERS
```javascript
const VENDOR_HEADERS = [
  'Vendor ID',      // Index 0
  'Name',           // Index 1 ← Form input: "Vendor Name"
  'PAN/VAT No',     // Index 2 ← Form input: "PAN/VAT No"
  'Address',        // Index 3 ← Form input: "Address"
  'Contact No',     // Index 4 ← Form input: "Contact No"
  'Created At'      // Index 5
];
```

## Frontend → Backend Data Flow

### Step 1: User Form Input (vendors.html)
User enters data in form fields:
- `vendorName` = "Fresh Market"
- `panNo` = "123456789"
- `contactNumber` = "9841000000"
- `address` = "Kathmandu, Nepal"

### Step 2: Form Submission (JavaScript)
Form sends payload to backend:
```javascript
const payload = {
  vendorName: vendorName,      // "Fresh Market"
  panNo: panNo,                // "123456789"
  contactNumber: contactNumber,// "9841000000"
  address: address             // "Kathmandu, Nepal"
};
```

### Step 3: Backend Processing (code.js)

#### normalizeVendorRequest() - Line 293
Normalizes and extracts values:
```javascript
const vendorName = String(payload.vendorName || payload.name || '').trim();
const panNo = String(payload.panNo || payload.panVatNo || payload.panvatno || '').trim();
const contactNumber = String(payload.contactNumber || payload.contactNo || payload.contactno || '').trim();
```

Returns normalized payload:
```javascript
{
  vendorName: "Fresh Market",
  panNo: "123456789",
  contactNumber: "9841000000",
  address: "Kathmandu, Nepal"
}
```

#### saveVendor() - Line 359
Creates record object with normalized values:
```javascript
const record = {
  vendorId: "V001",                    // Generated
  vendorName: "Fresh Market",          // From input
  panNo: "123456789",                  // From input
  address: "Kathmandu, Nepal",         // From input
  contactNumber: "9841000000",         // From input
  createdAt: "2026-08-30T..."          // Auto-generated
};
```

#### buildVendorRow() - Line 346
Maps record properties to VENDOR_HEADERS:

```
VENDOR_HEADERS[0] = 'Vendor ID'     → key = 'vendorid'   → vendor.vendorId
VENDOR_HEADERS[1] = 'Name'          → key = 'name'       → vendor.vendorName
VENDOR_HEADERS[2] = 'PAN/VAT No'    → key = 'panvatno'   → vendor.panNo ✓
VENDOR_HEADERS[3] = 'Address'       → key = 'address'    → vendor.address
VENDOR_HEADERS[4] = 'Contact No'    → key = 'contactno'  → vendor.contactNumber ✓
VENDOR_HEADERS[5] = 'Created At'    → key = 'createdat'  → vendor.createdAt
```

### Step 4: Data Storage
The buildVendorRow() returns array:
```javascript
[
  'V001',              // Column: Vendor ID
  'Fresh Market',      // Column: Name
  '123456789',         // Column: PAN/VAT No ✓
  'Kathmandu, Nepal',  // Column: Address
  '9841000000',        // Column: Contact No ✓
  '2026-08-30T...'     // Column: Created At
]
```

Sheet appends this row to the Vendors sheet with exact column alignment.

## Column Normalization Process

### normalizeHeaderKey() - Line 136
Converts column names to keys by:
1. Trimming whitespace
2. Converting to lowercase
3. Removing all non-alphanumeric characters

Examples:
```
'PAN/VAT No'  → 'pan' + 'vat' + 'no' → 'panvatno'
'Contact No'  → 'contact' + 'no' → 'contactno'
'Created At'  → 'created' + 'at' → 'createdat'
```

## Verification

✅ **PAN/VAT No Column Mapping**
- Form input field: `vendorPanNo`
- JavaScript variable: `panNo`
- Backend storage: `vendor.panNo`
- Column header: `'PAN/VAT No'`
- Normalized key: `'panvatno'`
- Stored in column index 2

✅ **Contact No Column Mapping**
- Form input field: `vendorContactNumber`
- JavaScript variable: `contactNumber`
- Backend storage: `vendor.contactNumber`
- Column header: `'Contact No'`
- Normalized key: `'contactno'`
- Stored in column index 4

## Complete Data Path Example

User Input → Payload → normalizeVendorRequest() → Record Object → buildVendorRow() → Sheet Columns

```
"123456789" (PAN input) 
    ↓
payload.panNo = "123456789"
    ↓
normalizeVendorRequest: panNo = "123456789"
    ↓
record.panNo = "123456789"
    ↓
buildVendorRow: vendor.panNo → 'PAN/VAT No' column
    ↓
Sheet: [V001, Fresh Market, "123456789", ..., "9841000000", ...]
                                  ↑ Column Index 2 (PAN/VAT No)
```

```
"9841000000" (Contact input)
    ↓
payload.contactNumber = "9841000000"
    ↓
normalizeVendorRequest: contactNumber = "9841000000"
    ↓
record.contactNumber = "9841000000"
    ↓
buildVendorRow: vendor.contactNumber → 'Contact No' column
    ↓
Sheet: [V001, Fresh Market, "123456789", ..., "9841000000"]
                                              ↑ Column Index 4 (Contact No)
```

## All Functions Working Together

1. **normalizeHeaderKey()** - Converts "PAN/VAT No" → "panvatno"
2. **normalizeVendorRequest()** - Extracts and normalizes form data
3. **saveVendor()** - Creates record with all fields
4. **buildVendorRow()** - Maps record properties to columns using normalized keys
5. **Sheet.appendRow()** - Stores array in exact column order

✅ **System is working correctly**
