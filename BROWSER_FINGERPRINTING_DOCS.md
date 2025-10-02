# Browser Fingerprinting Service Documentation

## Overview

The Browser Fingerprinting Service provides anonymous user tracking for forms that don't require authentication or email but need to prevent duplicate submissions. It creates unique fingerprints based on browser characteristics and device information.

## Features

- **Anonymous Tracking**: Track users without requiring login or email
- **Duplicate Prevention**: Prevent multiple submissions from the same browser/device
- **Fallback Methods**: Uses IP address as fallback when fingerprinting isn't reliable
- **Strength Assessment**: Evaluates fingerprint uniqueness (0-100 score)
- **Privacy Conscious**: Only stores hashed fingerprints, not raw browser data

## Implementation

### 1. Backend Services

#### FingerprintService (`src/utilities/fingerprint.ts`)

Core utility for generating and managing browser fingerprints.

**Key Methods:**

- `generateFingerprint(data)` - Creates SHA256 hash from browser data
- `extractFingerprintFromRequest(req)` - Extracts fingerprint data from HTTP request
- `getClientIP(req)` - Gets client IP with proxy support
- `validateFingerprint(fingerprint)` - Validates fingerprint reliability
- `getFingerprintStrength(fingerprint)` - Returns uniqueness score (0-100)

#### RespondentTrackingService (`src/services/RespondentTrackingService.ts`)

High-level service for respondent tracking and duplicate detection.

**Key Methods:**

- `checkRespondentExists(formId, req, ResponseModel)` - Check if user already responded
- `generateTrackingData(req)` - Create complete tracking data
- `createSubmissionWithTracking(baseData, req)` - Add tracking to submission data

### 2. Database Schema

The `FormResponseType` interface and schema now include:

```typescript
interface FormResponseType {
  // ... existing fields ...

  // Browser fingerprinting fields
  respondentFingerprint?: string; // SHA256 hash of browser characteristics
  respondentIP?: string; // Client IP address
  respondentSessionId?: string; // Session ID if available
  deviceInfo?: {
    // Raw device information
    userAgent: string;
    platform: string;
    screen: string;
    timezone: string;
    acceptLanguage: string;
    acceptEncoding: string;
  };
  fingerprintStrength?: number; // Uniqueness score (0-100)
}
```

### 3. Controller Integration

The `FormResponseController` now includes fingerprinting in:

**GetPublicFormData (verify case):**

- Checks for existing responses using fingerprint
- Falls back to IP address if fingerprint unavailable
- Returns appropriate error messages for duplicates

**SubmitFormResponse:**

- Generates tracking data before submission
- Includes fingerprint information in response data
- Prevents duplicate submissions for single-response forms

## Frontend Integration

### Basic Usage

```javascript
// Import the utility
import { collectBrowserFingerprint } from "./frontend-fingerprint-utils";

// Collect fingerprint headers
const headers = {
  "Content-Type": "application/json",
  ...collectBrowserFingerprint(),
};

// Use in API calls
fetch("/api/form/submit", {
  method: "POST",
  headers: headers,
  body: JSON.stringify(formData),
});
```

### Enhanced Security

```javascript
import { collectEnhancedFingerprint } from "./frontend-fingerprint-utils";

// For higher security requirements
const enhancedHeaders = {
  "Content-Type": "application/json",
  ...collectEnhancedFingerprint(),
};
```

### React Integration

```jsx
import { useState, useEffect } from "react";
import { collectBrowserFingerprint } from "./utils/fingerprint";

const FormComponent = () => {
  const [fingerprintHeaders, setFingerprintHeaders] = useState({});

  useEffect(() => {
    setFingerprintHeaders(collectBrowserFingerprint());
  }, []);

  const submitForm = async (formData) => {
    const response = await fetch("/api/form/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...fingerprintHeaders,
      },
      body: JSON.stringify(formData),
    });
    return response.json();
  };

  // ... rest of component
};
```

## Security Considerations

### Strengths

- **Device Uniqueness**: Combines multiple browser characteristics
- **Hash Security**: Stores SHA256 hashes, not raw data
- **Fallback Support**: Uses IP when fingerprint is weak
- **Validation**: Checks fingerprint reliability before trusting

### Limitations

- **Browser Changes**: Different browsers/incognito mode bypass tracking
- **VPN/Proxy**: IP-based fallback can be circumvented
- **Privacy Tools**: Some users may block fingerprint collection
- **Casual Prevention**: Best for preventing casual duplicates, not determined attackers

## Configuration

### Environment Variables

No specific environment variables required. The service uses standard HTTP headers.

### Database Indexes

The following indexes are automatically created for performance:

- `{ formId: 1, respondentFingerprint: 1 }`
- `{ formId: 1, respondentIP: 1 }`
- `{ formId: 1, respondentEmail: 1 }`

## Usage Examples

### Check if User Already Responded

```typescript
// In your controller
const trackingResult = await RespondentTrackingService.checkRespondentExists(
  formId,
  req,
  FormResponse
);

if (trackingResult.hasResponded) {
  return res.status(400).json({
    error: "You have already submitted a response",
    method: trackingResult.trackingMethod,
    strength: trackingResult.fingerprintStrength,
  });
}
```

### Create Submission with Tracking

```typescript
const submissionData = RespondentTrackingService.createSubmissionWithTracking(
  {
    formId: formId,
    responseset: responses,
    respondentEmail: email,
    respondentName: name,
  },
  req
);

// Save to database
const response = new FormResponse(submissionData);
await response.save();
```

## Troubleshooting

### Low Fingerprint Strength

If fingerprint strength is consistently low:

- Check if frontend is sending fingerprint headers
- Verify browser compatibility
- Consider using enhanced fingerprinting for better uniqueness

### False Positives

If legitimate users are blocked:

- Check IP-based detection in shared networks
- Consider reducing fingerprint strictness
- Implement admin override functionality

### Performance Issues

If queries are slow:

- Ensure database indexes are created
- Monitor fingerprint collection overhead
- Consider caching frequently checked fingerprints

## Best Practices

1. **Progressive Enhancement**: Use fingerprinting as additional security, not primary authentication
2. **User Communication**: Inform users about duplicate prevention measures
3. **Graceful Degradation**: Handle cases where fingerprinting fails
4. **Regular Monitoring**: Track fingerprint strength and duplicate detection rates
5. **Privacy Compliance**: Ensure fingerprinting complies with privacy regulations

## API Response Examples

### Successful Verification

```json
{
  "status": 200,
  "message": "OK"
}
```

### Duplicate Detected

```json
{
  "status": 400,
  "data": {
    "isResponse": true,
    "message": "You have already submitted a response to this form",
    "trackingMethod": "fingerprint",
    "fingerprintStrength": 85
  }
}
```

### Successful Submission

```json
{
  "status": 200,
  "message": "Form submitted successfully",
  "data": {
    "maxScore": 100,
    "totalScore": 85,
    "message": "Response recorded successfully"
  }
}
```
