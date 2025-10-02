# ResponseValidationService Enhancement

## Improved `hasRespondent` Method

The `hasRespondent` method has been significantly enhanced to provide more robust and flexible respondent tracking with multiple fallback strategies.

### Key Improvements

1. **Multiple Tracking Strategies**: Supports user ID, guest email, fingerprint, IP address, and combinations
2. **Confidence Levels**: Provides confidence ratings (high, medium, low) for tracking accuracy
3. **Detailed Metadata**: Returns comprehensive information about found responses
4. **Fallback Support**: Graceful degradation when primary tracking methods fail
5. **Better Error Handling**: Comprehensive error reporting and validation
6. **TypeScript Integration**: Fully typed interfaces for better development experience

### Usage Examples

#### Basic Usage with Fingerprint and IP

```typescript
import { ResponseValidationService } from "../services/ResponseValidationService";

// Check if respondent has already submitted
const result = await ResponseValidationService.hasRespondent("formId123", {
  fingerprint: "abc123def456",
  ipAddress: "192.168.1.100",
});

if (result.hasResponded) {
  console.log(`Found previous response: ${result.responseId}`);
  console.log(`Tracking method: ${result.trackingMethod}`);
  console.log(`Confidence: ${result.confidence}`);
}
```

#### Usage with Express Request (Recommended)

```typescript
// In your controller
const checkDuplicate = async (req: CustomRequest, res: Response) => {
  const formId = req.params.formId;

  // Automatically extract tracking data from request
  const result = await ResponseValidationService.hasRespondentFromRequest(
    formId,
    req,
    {
      includeFallbackChecks: true,
    }
  );

  if (result.hasResponded) {
    return res.status(409).json({
      error: "Duplicate submission detected",
      details: {
        previousResponseId: result.responseId,
        trackingMethod: result.trackingMethod,
        confidence: result.confidence,
        submittedAt: result.metadata?.submittedAt,
      },
    });
  }

  // Continue with form submission...
};
```

#### Advanced Usage with Custom Options

```typescript
// High-security check (requires exact match)
const strictResult = await ResponseValidationService.hasRespondent(
  "formId123",
  {
    fingerprint: "abc123def456",
    ipAddress: "192.168.1.100",
    userId: "user123",
    requireExactMatch: true,
    includeFallbackChecks: false,
  }
);

// Flexible check with fallbacks
const flexibleResult = await ResponseValidationService.hasRespondent(
  "formId123",
  {
    fingerprint: "abc123def456",
    ipAddress: "192.168.1.100",
    guestEmail: "user@example.com",
    includeFallbackChecks: true,
  }
);
```

#### Working with Different User Types

```typescript
// Authenticated user
const authResult = await ResponseValidationService.hasRespondent("formId123", {
  userId: "user123",
  fingerprint: "abc123def456", // Additional verification
});

// Guest user with email
const guestResult = await ResponseValidationService.hasRespondent("formId123", {
  guestEmail: "guest@example.com",
  fingerprint: "abc123def456",
  ipAddress: "192.168.1.100",
});

// Anonymous user (fingerprint/IP only)
const anonResult = await ResponseValidationService.hasRespondent("formId123", {
  fingerprint: "abc123def456",
  ipAddress: "192.168.1.100",
});
```

### Response Structure

```typescript
interface RespondentCheckResult {
  hasResponded: boolean;
  responseId?: string;
  trackingMethod:
    | "fingerprint"
    | "ip"
    | "fingerprint_and_ip"
    | "user_id"
    | "guest_email"
    | "none";
  confidence: "high" | "medium" | "low";
  metadata?: {
    fingerprint?: string;
    ipAddress?: string;
    userId?: string;
    guestEmail?: string;
    submittedAt?: Date;
    fingerprintStrength?: number;
  };
}
```

### Tracking Method Priority (High to Low Confidence)

1. **user_id**: Authenticated user (highest confidence)
2. **guest_email**: Guest user with email (high confidence)
3. **fingerprint_and_ip**: Both fingerprint and IP match (high confidence)
4. **fingerprint**: Fingerprint only (medium confidence)
5. **ip**: IP address only (low confidence)

### Integration with Controllers

Replace old `hasRespondentResponse` calls:

```typescript
// OLD (deprecated)
const hasResponse = await ResponseValidationService.hasRespondentResponse(
  formId,
  fingerprint,
  ipAddress
);

// NEW (improved)
const result = await ResponseValidationService.hasRespondent(formId, {
  fingerprint,
  ipAddress,
});
const hasResponse = result.hasResponded;
```

### Error Handling

```typescript
try {
  const result = await ResponseValidationService.hasRespondent(formId, options);
  // Handle result...
} catch (error) {
  console.error("Failed to check respondent:", error.message);
  // Handle error appropriately
}
```

### Performance Considerations

- The method uses database indexes for optimal performance
- Checks are performed in order of confidence (most reliable first)
- Early exit when `requireExactMatch` is true
- Lean queries to minimize data transfer

### Migration Notes

The old `hasRespondentResponse` method is still available but deprecated. It will log a warning when used and internally calls the new `hasRespondent` method for backward compatibility.

New projects should use `hasRespondent` or `hasRespondentFromRequest` for better functionality and type safety.
