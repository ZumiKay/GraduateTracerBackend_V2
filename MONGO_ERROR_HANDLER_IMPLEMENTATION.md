# MongoDB Error Handler Implementation Guide

## Overview

This guide demonstrates how to implement the centralized MongoDB error handler across all controllers in the application. The `MongoErrorHandler` provides consistent error management, appropriate HTTP status codes, and standardized logging.

## Quick Implementation Checklist

### 1. Import the MongoDB Error Handler

Add the import to the top of each controller file:

```typescript
import { MongoErrorHandler } from "../utilities/MongoErrorHandler";
```

### 2. Replace Existing Error Handlers

Transform existing try-catch blocks from this pattern:

```typescript
// OLD PATTERN
try {
  // database operations
} catch (error) {
  console.log("Some error", error);
  return res.status(500).json(ReturnCode(500));
}
```

To this enhanced pattern:

```typescript
// NEW PATTERN
const operationId = MongoErrorHandler.generateOperationId("operation_name");

try {
  // database operations
} catch (error) {
  console.error(`[${operationId}] Operation description error:`, error);

  const mongoErrorHandled = MongoErrorHandler.handleMongoError(error, res, {
    operationId,
    customMessage: "User-friendly error message",
    includeErrorDetails: process.env.NODE_ENV === "development",
  });

  if (!mongoErrorHandled.handled) {
    return res.status(500).json(ReturnCode(500, "Fallback error message"));
  }
}
```

## Controller-by-Controller Implementation

### ✅ **form_response.controller.ts** - COMPLETED

- Enhanced SubmitFormResponse method with MongoDB error handling
- Database retrieval operations use the error handler
- Main error catch block uses MongoDB error handler

### ✅ **user.controller.ts** - COMPLETED

- GetRespondentProfile function updated
- RegisterUser function updated
- Remaining functions need updating

### ✅ **form.controller.ts** - PARTIALLY COMPLETED

- ManageFormCollaborator function updated
- Remaining 19 error handlers need updating

### 🔄 **Remaining Controllers to Update**

#### content.controller.ts

```typescript
// Functions with error handlers to update:
- Line 43: Content creation error
- Line 94: Content update error
- Line 121: Content deletion error
- Line 150: Form validation error
```

#### export.controller.ts

```typescript
// Functions with error handlers to update:
- Line 44: Get available columns error
- Line 79: Get export jobs error
- Line 132: Create export job error
```

#### authentication.controller.ts

```typescript
// Functions with error handlers to update:
- Multiple authentication-related database operations
```

#### notification.controller.ts

```typescript
// Functions with error handlers to update:
- Notification CRUD operations
```

## Implementation Examples

### Example 1: Simple Database Query

```typescript
// Before
export async function GetUserProfile(req: Request, res: Response) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json(ReturnCode(404, "User not found"));
    }
    return res.status(200).json({ ...ReturnCode(200), data: user });
  } catch (error) {
    console.log("Get user error", error);
    return res.status(500).json(ReturnCode(500));
  }
}

// After
export async function GetUserProfile(req: Request, res: Response) {
  const operationId = MongoErrorHandler.generateOperationId("get_user");

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json(ReturnCode(404, "User not found"));
    }
    return res.status(200).json({ ...ReturnCode(200), data: user });
  } catch (error) {
    console.error(`[${operationId}] Get user profile error:`, error);

    const mongoErrorHandled = MongoErrorHandler.handleMongoError(error, res, {
      operationId,
      customMessage: "Failed to retrieve user profile",
    });

    if (!mongoErrorHandled.handled) {
      return res.status(500).json(ReturnCode(500));
    }
  }
}
```

### Example 2: Complex Database Operations

```typescript
// Before
export async function CreateForm(req: CustomRequest, res: Response) {
  try {
    const form = await Form.create({
      ...req.body,
      user: req.user.id,
    });

    await Content.insertMany(
      req.body.contents.map((content) => ({
        ...content,
        formId: form._id,
      }))
    );

    return res.status(201).json({ ...ReturnCode(201), data: form });
  } catch (error) {
    console.log("Create form error", error);
    return res.status(500).json(ReturnCode(500, "Failed to create form"));
  }
}

// After
export async function CreateForm(req: CustomRequest, res: Response) {
  const operationId = MongoErrorHandler.generateOperationId("create_form");

  try {
    const form = await Form.create({
      ...req.body,
      user: req.user.id,
    });

    await Content.insertMany(
      req.body.contents.map((content) => ({
        ...content,
        formId: form._id,
      }))
    );

    return res.status(201).json({ ...ReturnCode(201), data: form });
  } catch (error) {
    console.error(`[${operationId}] Create form error:`, error);

    const mongoErrorHandled = MongoErrorHandler.handleMongoError(error, res, {
      operationId,
      customMessage: "Failed to create form",
      includeErrorDetails: true,
    });

    if (!mongoErrorHandled.handled) {
      return res.status(500).json(ReturnCode(500, "Failed to create form"));
    }
  }
}
```

### Example 3: Using the Wrapper Function

For simpler cases, you can use the wrapper function:

```typescript
export async function GetUserById(req: Request, res: Response) {
  const operationId = MongoErrorHandler.generateOperationId("get_user_by_id");

  const user = await MongoErrorHandler.executeWithErrorHandling(
    () => User.findById(req.params.id),
    res,
    {
      operationId,
      customMessage: "Failed to retrieve user",
    }
  );

  if (user === null) return; // Error was handled by the wrapper

  if (!user) {
    return res.status(404).json(ReturnCode(404, "User not found"));
  }

  return res.status(200).json({ ...ReturnCode(200), data: user });
}
```

## Error Categories Handled

The MongoDB error handler automatically categorizes and handles:

1. **Connection Errors (503)** - Network timeouts, connection failures
2. **Authentication Errors (401)** - Database authentication failures
3. **Duplicate Key Errors (409)** - Unique constraint violations
4. **Validation Errors (400)** - Schema validation failures, cast errors
5. **Not Found Errors (404)** - Document not found
6. **Write Concern Errors (503)** - Write operation failures
7. **Parse Errors (400)** - Query syntax errors
8. **Schema Errors (500)** - Model definition issues
9. **Generic Server Errors (500)** - Other MongoDB errors

## Benefits

### For Developers

- **Consistent Error Handling**: Same pattern across all controllers
- **Better Debugging**: Operation IDs for error tracking
- **Reduced Boilerplate**: Centralized error logic

### For Users

- **Appropriate Status Codes**: Correct HTTP responses for different error types
- **User-Friendly Messages**: Clear error descriptions
- **Retry Guidance**: Automatic retry recommendations for temporary issues

### For Operations

- **Structured Logging**: Consistent log format with operation IDs
- **Error Categorization**: Easy identification of error patterns
- **Monitoring Ready**: Standardized error responses for alerting

## Rollout Strategy

### Phase 1: Critical Controllers (Completed)

- ✅ form_response.controller.ts (main submission handling)
- ✅ user.controller.ts (basic user operations)
- ✅ form.controller.ts (partial - collaborator management)

### Phase 2: Core Controllers (Next)

- content.controller.ts (content CRUD)
- authentication.controller.ts (login/auth)
- export.controller.ts (data export)

### Phase 3: Remaining Controllers

- notification.controller.ts
- question.controller.ts
- recaptcha.controller.ts
- form_response_return.controller.ts

## Testing

After implementing in each controller:

1. **Test MongoDB Connection Errors**: Simulate network issues
2. **Test Validation Errors**: Send invalid data
3. **Test Duplicate Key Errors**: Attempt duplicate creation
4. **Verify Logging**: Check that operation IDs appear in logs
5. **Confirm Status Codes**: Verify appropriate HTTP responses

## Migration Notes

- **Backward Compatibility**: Error response format remains compatible
- **Additional Fields**: New responses include `operationId` and `errorCategory`
- **Status Codes**: Some responses may have more appropriate status codes
- **Logging**: Enhanced logging with operation IDs for better debugging

This implementation provides enterprise-grade error handling with minimal code changes and maximum benefit!
