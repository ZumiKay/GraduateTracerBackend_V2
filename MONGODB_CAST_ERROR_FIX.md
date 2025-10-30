# 🐛 MongoDB Cast Error Fix - Session ID Type Mismatch

## Problem Description

MongoDB validation error when submitting a form with `submitonce` setting:

```
VALIDATION_ERROR: Cast to string failed for value "{...}" (type Object) at path "session_id" for model "Formsession"
```

The error occurs because an **object** was being passed to the `session_id` field instead of a **string**.

### Error Stack

```
CastError: Cast to string failed for value "{\n  data: {...},\n  sub: 'eyJhbGciOi...',\n  access_token: 'eyJhbGciOi...',\n  access_payload: {...}\n}" (type Object) at path "session_id" for model "Formsession"
```

---

## Root Cause Analysis

### The Issue

In `/src/controller/form_response.controller.ts` line 446:

```typescript
// ❌ WRONG - Passing entire formsession object
await Formsession.deleteOne({ session_id: req.formsession });
```

### Why It Failed

The `req.formsession` middleware attachment contains the full JWT payload structure:

```typescript
req.formsession = {
  data: { email, timestamp, random, process, attempt, entropy, nanotime, iat, exp },
  sub: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",      // ← The actual JWT token string
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  access_payload: { email, formId, type, iat, exp, ... }
}
```

- **`req.formsession`** = entire object
- **`req.formsession.sub`** = the JWT token string that should be stored in `session_id`

MongoDB's string schema type validation rejects the entire object when expecting a string.

---

## Solution Applied

### Fix Location

**File:** `/src/controller/form_response.controller.ts`  
**Line:** 446

### Before

```typescript
//Delete user session if form is single response
if (form.setting?.submitonce && req.formsession) {
  await Formsession.deleteOne({ session_id: req.formsession }); // ❌ Passing object
}
```

### After

```typescript
//Delete user session if form is single response
if (form.setting?.submitonce && req.formsession) {
  await Formsession.deleteOne({ session_id: req.formsession.sub }); // ✅ Passing JWT string
}
```

---

## Key Learnings

### 1. **Object Property Extraction**

When middleware attaches complex objects to the request, always extract the specific property needed:

```typescript
// ❌ Don't pass the entire object
deleteOne({ field: req.customObject });

// ✅ Extract and pass the specific value
deleteOne({ field: req.customObject.propertyName });
```

### 2. **MongoDB Schema Type Validation**

Schema fields with strict types enforce casting:

```typescript
// This will fail if session_id is defined as String
session_id: String; // Rejects objects
```

### 3. **JWT Payload Structure**

The middleware creates a nested structure with `sub` containing the actual token:

```typescript
{
  data: { /* Extracted JWT payload */ },
  sub: "jwt_token_string",              // ← The session_id value
  access_token: "access_jwt_token",
  access_payload: { /* ... */ }
}
```

---

## Validation Checklist

- ✅ Fixed the incorrect property access
- ✅ Verified `req.formsession.sub` contains the JWT string
- ✅ Confirmed MongoDB `session_id` field expects `String` type
- ✅ Checked all other `req.formsession` usages in the codebase
  - ✅ Line 944: Uses `req.formsession?.sub` correctly
  - ✅ Line 946: Only checks if exists, doesn't pass to query
  - ✅ Line 1031: Only checks if exists, doesn't pass to query

---

## Files Modified

| File                                          | Line | Change                                                                     | Status   |
| --------------------------------------------- | ---- | -------------------------------------------------------------------------- | -------- |
| `/src/controller/form_response.controller.ts` | 446  | Changed `session_id: req.formsession` to `session_id: req.formsession.sub` | ✅ Fixed |

---

## Testing Recommendations

### 1. **Submit Form with `submitonce` Setting**

```bash
# Test scenario:
1. Create/select a form with submitonce = true
2. Fill and submit the form
3. Verify session is deleted from Formsession collection
4. Confirm no MongoDB cast error appears
```

### 2. **Verify Session Cleanup**

```bash
# In MongoDB:
db.formsessions.find({ session_id: "<the_jwt_token>" })
# Should return empty after submission with submitonce=true
```

### 3. **Edge Cases**

- ✅ Form without `submitonce` setting (session should NOT be deleted)
- ✅ Form with `submitonce` but no valid session
- ✅ Multiple form submissions in sequence

---

## Related Code Patterns

### Correct Session Deletion Patterns (Reference)

**In `/src/middleware/Formsession.middleware.ts` (Line 117):**

```typescript
await Formsession.deleteOne({ session_id: sessionToken }); // ✅ Correct - using extracted token string
```

**In `/src/controller/formsession.controller.ts` (Line 607):**

```typescript
await Formsession.deleteOne({ session_id }).catch((cleanupError) => {  // ✅ Correct - session_id is string variable
```

**In `/src/controller/formsession.controller.ts` (Line 752):**

```typescript
await Formsession.deleteOne({ session_id: req.formsession?.sub }); // ✅ Correct - extracting sub property
```

---

## Prevention Guide

To prevent similar issues:

1. **Always validate middleware attachments** - Check what type/structure is being added to `req`
2. **Extract specific properties** - Don't pass entire middleware objects to queries
3. **Type your request objects** - Use TypeScript interfaces to enforce proper access patterns
4. **Test edge cases** - Specifically test features that use single-response forms

```typescript
// Good practice: Define clear types
interface CustomRequest extends Request {
  formsession?: {
    data: Record<string, any>;
    sub: string; // ← Clear this is a string
    access_token: string;
    access_payload: Record<string, any>;
  };
}

// Then use it safely:
await Formsession.deleteOne({
  session_id: req.formsession?.sub, // ✅ TypeScript knows this is string
});
```

---

## Impact

- ✅ Fixes MongoDB validation errors for single-response form submissions
- ✅ Properly cleans up sessions after submission
- ✅ No breaking changes to existing functionality
- ✅ Improves data integrity by deleting sessions as intended
