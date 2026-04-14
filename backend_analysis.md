# Backend Full Analysis — Tomato Monitoring Platform

> Source of truth: actual backend source code + both markdown documentation files.
> Stack: Django + DRF + PostgreSQL + Simple JWT

---

## 1. AUTH FLOW

### Token Behavior
- **Type**: Simple JWT (Bearer tokens)
- **Access token lifetime**: 15 minutes
- **Refresh token lifetime**: 1 day
- **Header format**: `Authorization: Bearer <access_token>`
- Both login and refresh endpoints are **public** (`AllowAny`, no authentication required)
- All other endpoints require authentication by default (`IsAuthenticated`)

### Endpoints

| Method | URL | Auth required | Purpose |
|--------|-----|--------------|---------|
| POST | `/api/v1/auth/login/` | No | Issue access + refresh tokens |
| POST | `/api/v1/auth/refresh/` | No | Issue new access token |
| GET | `/api/v1/auth/me/` | Yes (Bearer) | Get current authenticated user |

### Login Request Payload
```json
{
  "username": "admin",
  "password": "admin1234"
}
```

### Login Response (200 OK)
```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>"
}
```

### Refresh Request Payload
```json
{
  "refresh": "<jwt_refresh_token>"
}
```

### Refresh Response (200 OK)
```json
{
  "access": "<new_jwt_access_token>"
}
```

### `/api/v1/auth/me/` Response (200 OK)
```json
{
  "id": "uuid-string",
  "username": "admin",
  "email": "admin@example.com",
  "first_name": "",
  "last_name": "",
  "role": {
    "id": "uuid-string",
    "name": "admin"
  }
}
```

> **Note**: `role` is `null` if the user has no role assigned. All `id` fields are UUID strings.

---

## 2. ENTITY MAP (Relationships)

```
Role
└── User (FK → Role, nullable, on_delete=PROTECT)

Site
└── Greenhouse (FK → Site, on_delete=CASCADE)
    └── Zone (FK → Greenhouse, on_delete=CASCADE)
        └── Device (FK → Zone, on_delete=CASCADE)

Disease
├── DiseaseCause (FK → Disease, on_delete=CASCADE, related_name="causes")
├── DiseaseTreatment (FK → Disease, on_delete=CASCADE, related_name="treatments")
└── DiseaseResource (FK → Disease, on_delete=CASCADE, related_name="resources")

ModelVersion
└── InferenceIndex (FK → ModelVersion, on_delete=CASCADE, related_name="indexes")

Inspection
├── Device (FK → Device, on_delete=PROTECT)
├── InferenceIndex (FK → InferenceIndex, on_delete=PROTECT)
├── Disease (FK → Disease, nullable, on_delete=SET_NULL) ← predicted_disease
└── InspectionMatch (FK → Inspection, on_delete=CASCADE, related_name="matches")
    └── Disease (FK → Disease, nullable, on_delete=SET_NULL)

Review (OneToOne → Inspection, on_delete=CASCADE)
├── User (FK → User, nullable, on_delete=SET_NULL) ← reviewer
└── Disease (FK → Disease, nullable, on_delete=SET_NULL) ← corrected_disease

EmbeddingRecord
├── ModelVersion (FK → ModelVersion, on_delete=CASCADE)
└── Inspection (FK → Inspection, nullable, on_delete=SET_NULL)
```

---

## 3. API ENDPOINTS (Grouped by Domain)

### 3.1 Health / Schema

| Method | URL | Auth | Notes |
|--------|-----|------|-------|
| GET | `/api/health/` | No | Legacy health check |
| GET | `/api/v1/health/` | No | Current health check |
| GET | `/api/v1/schema/` | No | OpenAPI schema |

Health response: `{"status": "ok"}`

---

### 3.2 Auth (`/api/v1/auth/`)

| Method | URL | Auth | Notes |
|--------|-----|------|-------|
| POST | `/api/v1/auth/login/` | No | Returns access + refresh tokens |
| POST | `/api/v1/auth/refresh/` | No | Returns new access token |
| GET | `/api/v1/auth/me/` | Yes | Returns current user + role |

---

### 3.3 Catalog (`/api/v1/catalog/`)

All endpoints: **IsAuthenticated**

| Method | URL | Notes |
|--------|-----|-------|
| GET | `/api/v1/catalog/diseases/` | List all diseases (paginated) |
| POST | `/api/v1/catalog/diseases/` | Create disease |
| GET | `/api/v1/catalog/diseases/{id}/` | Retrieve single disease |
| PUT | `/api/v1/catalog/diseases/{id}/` | Full update |
| PATCH | `/api/v1/catalog/diseases/{id}/` | Partial update |
| DELETE | `/api/v1/catalog/diseases/{id}/` | Delete |
| GET | `/api/v1/catalog/disease-causes/` | List causes |
| POST | `/api/v1/catalog/disease-causes/` | Create cause |
| GET | `/api/v1/catalog/disease-causes/{id}/` | Retrieve |
| PUT/PATCH/DELETE | `/api/v1/catalog/disease-causes/{id}/` | CRUD |
| GET | `/api/v1/catalog/disease-treatments/` | List treatments |
| POST | `/api/v1/catalog/disease-treatments/` | Create treatment |
| GET | `/api/v1/catalog/disease-treatments/{id}/` | Retrieve |
| PUT/PATCH/DELETE | `/api/v1/catalog/disease-treatments/{id}/` | CRUD |
| GET | `/api/v1/catalog/disease-resources/` | List resources |
| POST | `/api/v1/catalog/disease-resources/` | Create resource |
| GET | `/api/v1/catalog/disease-resources/{id}/` | Retrieve |
| PUT/PATCH/DELETE | `/api/v1/catalog/disease-resources/{id}/` | CRUD |

---

### 3.4 Devices (`/api/v1/devices/`)

All endpoints: **IsAuthenticated**

| Method | URL | Notes |
|--------|-----|-------|
| GET | `/api/v1/devices/sites/` | List all sites |
| POST | `/api/v1/devices/sites/` | Create site |
| GET | `/api/v1/devices/sites/{id}/` | Retrieve (with nested greenhouses→zones→devices) |
| PUT/PATCH/DELETE | `/api/v1/devices/sites/{id}/` | CRUD |
| GET | `/api/v1/devices/greenhouses/` | List greenhouses |
| POST | `/api/v1/devices/greenhouses/` | Create greenhouse |
| GET | `/api/v1/devices/greenhouses/{id}/` | Retrieve (with nested zones→devices) |
| PUT/PATCH/DELETE | `/api/v1/devices/greenhouses/{id}/` | CRUD |
| GET | `/api/v1/devices/zones/` | List zones |
| POST | `/api/v1/devices/zones/` | Create zone |
| GET | `/api/v1/devices/zones/{id}/` | Retrieve (with nested devices) |
| PUT/PATCH/DELETE | `/api/v1/devices/zones/{id}/` | CRUD |
| GET | `/api/v1/devices/devices/` | List devices |
| POST | `/api/v1/devices/devices/` | Create device |
| GET | `/api/v1/devices/devices/{id}/` | Retrieve device |
| PUT/PATCH/DELETE | `/api/v1/devices/devices/{id}/` | CRUD |

---

### 3.5 Inference (`/api/v1/inference/`)

All endpoints: **IsAuthenticated**

| Method | URL | Notes |
|--------|-----|-------|
| GET | `/api/v1/inference/model-versions/` | List model versions |
| POST | `/api/v1/inference/model-versions/` | Create |
| GET | `/api/v1/inference/model-versions/{id}/` | Retrieve (with nested indexes) |
| PUT/PATCH/DELETE | `/api/v1/inference/model-versions/{id}/` | CRUD |
| GET | `/api/v1/inference/indexes/` | List inference indexes |
| POST | `/api/v1/inference/indexes/` | Create |
| GET | `/api/v1/inference/indexes/{id}/` | Retrieve |
| PUT/PATCH/DELETE | `/api/v1/inference/indexes/{id}/` | CRUD |

---

### 3.6 Inspections (`/api/v1/inspections/`)

All endpoints: **IsAuthenticated**

| Method | URL | Notes |
|--------|-----|-------|
| GET | `/api/v1/inspections/inspections/` | List inspections (paginated) |
| POST | `/api/v1/inspections/inspections/` | Create with nested matches |
| GET | `/api/v1/inspections/inspections/{id}/` | Retrieve with nested matches |
| PUT/PATCH/DELETE | `/api/v1/inspections/inspections/{id}/` | CRUD |
| GET | `/api/v1/inspections/inspection-matches/` | List all matches |
| POST | `/api/v1/inspections/inspection-matches/` | Create a match individually |
| GET | `/api/v1/inspections/inspection-matches/{id}/` | Retrieve |
| PUT/PATCH/DELETE | `/api/v1/inspections/inspection-matches/{id}/` | CRUD |

---

### 3.7 Review (`/api/v1/review/`)

All endpoints: **IsAuthenticated**

| Method | URL | Notes |
|--------|-----|-------|
| GET | `/api/v1/review/reviews/` | List reviews |
| POST | `/api/v1/review/reviews/` | Create review |
| GET | `/api/v1/review/reviews/{id}/` | Retrieve |
| PUT/PATCH/DELETE | `/api/v1/review/reviews/{id}/` | CRUD |

---

## 4. JSON RESPONSE SHAPES (Real, from serializers/models)

### 4.1 User (GET /api/v1/auth/me/)
```json
{
  "id": "3f1a92b4-0000-0000-0000-000000000001",
  "username": "admin",
  "email": "admin@example.com",
  "first_name": "",
  "last_name": "",
  "role": {
    "id": "3f1a92b4-0000-0000-0000-000000000002",
    "name": "admin"
  }
}
```

### 4.2 Site (GET /api/v1/devices/sites/{id}/)
```json
{
  "id": "uuid",
  "name": "Main Site",
  "location": "Rabat, Morocco",
  "greenhouses": [
    {
      "id": "uuid",
      "site": "uuid",
      "name": "Greenhouse A",
      "description": "",
      "zones": [
        {
          "id": "uuid",
          "greenhouse": "uuid",
          "name": "Zone 1",
          "description": "",
          "devices": [
            {
              "id": "uuid",
              "zone": "uuid",
              "name": "Device Alpha",
              "identifier": "DEV-001",
              "description": "",
              "created_at": "2024-01-01T00:00:00Z",
              "updated_at": "2024-01-01T00:00:00Z"
            }
          ],
          "created_at": "2024-01-01T00:00:00Z",
          "updated_at": "2024-01-01T00:00:00Z"
        }
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

> **Note**: List endpoints (`GET /sites/`) return paginated results, NOT the full nested tree. The nested tree only appears on individual serializer responses. The `site` field in Greenhouse is the parent UUID (FK).

### 4.3 Device (GET /api/v1/devices/devices/{id}/)
```json
{
  "id": "uuid",
  "zone": "uuid",
  "name": "Device Alpha",
  "identifier": "DEV-001",
  "description": "",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 4.4 Disease (GET /api/v1/catalog/diseases/{id}/)
```json
{
  "id": "uuid",
  "name": "Early Blight",
  "slug": "early-blight",
  "summary": "A fungal disease...",
  "symptoms": "Dark spots on leaves...",
  "prevention": "Rotate crops...",
  "causes": [
    {
      "id": "uuid",
      "disease": "uuid",
      "title": "Alternaria solani fungus",
      "description": "Primary causal agent...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "treatments": [
    {
      "id": "uuid",
      "disease": "uuid",
      "title": "Apply fungicide",
      "description": "Use copper-based fungicide...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "resources": [
    {
      "id": "uuid",
      "disease": "uuid",
      "title": "Extension guide",
      "url": "https://example.com/early-blight",
      "description": "University extension resource...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 4.5 ModelVersion (GET /api/v1/inference/model-versions/{id}/)
```json
{
  "id": "uuid",
  "name": "MobileNetV2",
  "version": "v1.0",
  "framework": "tensorflow",
  "artifact_path": "/ai_assets/models/mobilenetv2.h5",
  "checksum": "sha256:...",
  "is_active": true,
  "notes": "",
  "indexes": [
    {
      "id": "uuid",
      "model_version": "uuid",
      "name": "leaf-demo-index",
      "organ_type": "leaf",
      "index_path": "/ai_assets/indexes/leaf.index",
      "metadata_path": "/ai_assets/metadata/leaf_metadata.csv",
      "threshold_default": 0.8,
      "top_k_default": 5,
      "is_active": true,
      "loaded_at": null,
      "notes": "",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 4.6 InferenceIndex (GET /api/v1/inference/indexes/{id}/)
```json
{
  "id": "uuid",
  "model_version": "uuid",
  "name": "leaf-demo-index",
  "organ_type": "leaf",
  "index_path": "/ai_assets/indexes/leaf.index",
  "metadata_path": "/ai_assets/metadata/leaf_metadata.csv",
  "threshold_default": 0.8,
  "top_k_default": 5,
  "is_active": true,
  "loaded_at": null,
  "notes": "",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 4.7 Inspection (GET /api/v1/inspections/inspections/{id}/)
```json
{
  "id": "uuid",
  "device": "uuid",
  "inference_index": "uuid",
  "predicted_disease": "uuid",
  "organ_type": "leaf",
  "status": "new",
  "processing_status": "completed",
  "source_message_id": "msg-001",
  "top1_label": "Early Blight",
  "confidence_score": 0.92,
  "captured_at": "2024-01-01T10:00:00Z",
  "received_at": "2024-01-01T10:00:05Z",
  "processed_at": "2024-01-01T10:00:10Z",
  "extra_metadata": {},
  "matches": [
    {
      "id": "uuid",
      "inspection": "uuid",
      "disease": "uuid",
      "rank_order": 1,
      "matched_label": "Early Blight",
      "similarity_score": 0.92,
      "metadata_json": {},
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "inspection": "uuid",
      "disease": null,
      "rank_order": 2,
      "matched_label": "Late Blight",
      "similarity_score": 0.74,
      "metadata_json": {},
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 4.8 Inspection CREATE Payload (POST /api/v1/inspections/inspections/)
```json
{
  "device": "uuid",
  "inference_index": "uuid",
  "predicted_disease": "uuid",
  "organ_type": "leaf",
  "status": "new",
  "processing_status": "completed",
  "source_message_id": "msg-001",
  "top1_label": "Early Blight",
  "confidence_score": 0.92,
  "captured_at": "2024-01-01T10:00:00Z",
  "received_at": "2024-01-01T10:00:05Z",
  "processed_at": "2024-01-01T10:00:10Z",
  "extra_metadata": {},
  "matches": [
    {
      "disease": "uuid",
      "rank_order": 1,
      "matched_label": "Early Blight",
      "similarity_score": 0.92,
      "metadata_json": {}
    },
    {
      "disease": null,
      "rank_order": 2,
      "matched_label": "Late Blight",
      "similarity_score": 0.74
    }
  ]
}
```

> **Required fields**: `device`, `inference_index`, `organ_type`, `captured_at`, `received_at`
> **Optional fields**: `predicted_disease`, `status`, `processing_status`, `source_message_id`, `top1_label`, `confidence_score`, `processed_at`, `extra_metadata`, `matches`
> **matches**: optional list. `rank_order` inside each match is optional (auto-assigned from index if missing).

### 4.9 Review (GET /api/v1/review/reviews/{id}/)
```json
{
  "id": "uuid",
  "inspection": "uuid",
  "reviewer": "uuid",
  "corrected_disease": null,
  "decision": "accepted",
  "comments": "Looks correct.",
  "reviewed_at": "2024-01-01T12:00:00Z",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

### 4.10 Review CREATE Payload (POST /api/v1/review/reviews/)
```json
{
  "inspection": "uuid",
  "reviewer": "uuid",
  "corrected_disease": null,
  "decision": "accepted",
  "comments": "Machine result is correct."
}
```

> For `decision: "corrected"`:
```json
{
  "inspection": "uuid",
  "reviewer": "uuid",
  "corrected_disease": "uuid-of-disease",
  "decision": "corrected",
  "comments": "Model was wrong — correct disease is Early Blight."
}
```

---

## 5. PAGINATION STRUCTURE

All list endpoints return paginated responses using `StandardResultsSetPagination` (PageNumberPagination).

**Default page size**: 20  
**Maximum page size**: 100  
**Page size param**: `page_size`  
**Page param**: `page`

### Standard List Response Envelope
```json
{
  "count": 45,
  "next": "http://localhost:8000/api/v1/catalog/diseases/?page=2",
  "previous": null,
  "results": [
    { ... },
    { ... }
  ]
}
```

- `count`: total number of records matching the filter
- `next`: URL of next page (`null` if none)
- `previous`: URL of previous page (`null` if none)
- `results`: array of objects for the current page

---

## 6. FILTERING & QUERY PARAMS

All viewsets use `SearchFilter` and `OrderingFilter` from DRF plus `apply_query_filters` custom logic.

### Global Params (all list endpoints)
| Param | Example | Behavior |
|-------|---------|----------|
| `search` | `?search=blight` | Full-text search across `search_fields` |
| `ordering` | `?ordering=-created_at` | Order results, prefix `-` for descending |
| `page` | `?page=2` | Page number |
| `page_size` | `?page_size=10` | Items per page (max 100) |

### Site-specific filters
| Param | Lookup | Example |
|-------|--------|---------|
| `name` | `name__icontains` | `?name=main` |

### Greenhouse-specific filters
| Param | Lookup |
|-------|--------|
| `site` | `site_id` (exact UUID) |

### Zone-specific filters
| Param | Lookup |
|-------|--------|
| `greenhouse` | `greenhouse_id` (exact UUID) |
| `site` | `greenhouse__site_id` (exact UUID) |

### Device-specific filters
| Param | Lookup |
|-------|--------|
| `zone` | `zone_id` (exact UUID) |
| `greenhouse` | `zone__greenhouse_id` (exact UUID) |
| `site` | `zone__greenhouse__site_id` (exact UUID) |
| `identifier` | `identifier` (exact) |

### Disease-specific filters
| Param | Lookup |
|-------|--------|
| `name` | `name__icontains` |
| `slug` | `slug` (exact) |

### DiseaseCause / DiseaseTreatment / DiseaseResource filters
| Param | Lookup |
|-------|--------|
| `disease` | `disease_id` (exact UUID) |

### ModelVersion filters
| Param | Lookup |
|-------|--------|
| `name` | `name__icontains` |
| `version` | `version` (exact) |
| `is_active` | `is_active` (boolean: `true`/`false`/`1`/`0`) |

### InferenceIndex filters
| Param | Lookup |
|-------|--------|
| `model_version` | `model_version_id` (exact UUID) |
| `organ_type` | `organ_type` (exact: `leaf` or `fruit`) |
| `is_active` | `is_active` (boolean) |
| `name` | `name__icontains` |

### Inspection filters
| Param | Lookup |
|-------|--------|
| `device` | `device_id` (exact UUID) |
| `inference_index` | `inference_index_id` (exact UUID) |
| `predicted_disease` | `predicted_disease_id` (exact UUID) |
| `organ_type` | `organ_type` (exact: `leaf` or `fruit`) |
| `status` | `status` (exact: `new`/`reviewed`/`closed`) |
| `processing_status` | `processing_status` (exact: `pending`/`processing`/`completed`/`failed`) |
| `source_message_id` | `source_message_id` (exact) |

### Review filters
| Param | Lookup |
|-------|--------|
| `inspection` | `inspection_id` (exact UUID) |
| `reviewer` | `reviewer_id` (exact UUID) |
| `corrected_disease` | `corrected_disease_id` (exact UUID) |
| `decision` | `decision` (exact: `accepted`/`corrected`/`rejected`) |

### InspectionMatch filters
| Param | Lookup |
|-------|--------|
| `inspection` | `inspection_id` (exact UUID) |
| `disease` | `disease_id` (exact UUID) |

---

## 7. BUSINESS RULES (Critical for Frontend Validation)

### Inspection Rules
1. **`organ_type`** must match the `organ_type` of the referenced `InferenceIndex`. If they mismatch, the backend returns a `400` validation error on `inference_index`.
2. **`confidence_score`** must be `null` or a float between 0 and 1.
3. **`status`** choices: `new`, `reviewed`, `closed` (default: `new`)
4. **`processing_status`** choices: `pending`, `processing`, `completed`, `failed` (default: `pending`)
5. **`captured_at`** and **`received_at`** are **required** datetime fields.
6. **`matches[].similarity_score`** must be between 0 and 1.
7. **`matches[].rank_order`** must be unique per inspection. If not provided, it is auto-assigned from the list index (1-based).
8. **`matches`** list is optional; can be empty or omitted.

### Review Rules
1. **`inspection`** is required and must reference an existing `Inspection`.
2. **`decision`** is required. Choices: `accepted`, `corrected`, `rejected`.
3. **`corrected_disease`** is REQUIRED when `decision` is `corrected`. If decision is `corrected` and `corrected_disease` is `null`, the backend returns `400` with error on `corrected_disease`.
4. **`reviewer`** is optional. If not supplied, the backend defaults `reviewer` to the currently authenticated request user.
5. **`reviewed_at`** is read-only on create (set automatically to `now()`). On update (`PATCH`/`PUT`), it is automatically refreshed to `now()` by the view's `perform_update()`.
6. **One inspection can have at most one review** (OneToOne relationship). Attempting to create a second review for the same inspection will fail with a unique constraint error.

### Disease Rules
- `name` is unique across all diseases.
- `slug` is unique across all diseases.

### Device Hierarchy Uniqueness
- Greenhouse `name` is unique per `site`.
- Zone `name` is unique per `greenhouse`.
- Device `name` is unique per `zone`.
- Device `identifier` is globally unique.

---

## 8. FIELD CHOICE ENUMERATIONS

### `InferenceIndex.organ_type` / `Inspection.organ_type`
- `"leaf"` → Leaf
- `"fruit"` → Fruit

### `Inspection.status`
- `"new"` (default)
- `"reviewed"`
- `"closed"`

### `Inspection.processing_status`
- `"pending"` (default)
- `"processing"`
- `"completed"`
- `"failed"`

### `Review.decision`
- `"accepted"`
- `"corrected"`
- `"rejected"`

---

## 9. READ-ONLY FIELDS ON ALL MODELS

All entities expose the following as read-only (never send in write payloads):
- `id` (UUID, auto-generated)
- `created_at` (auto set on create)
- `updated_at` (auto set on save)

Additionally:
- `Review.reviewed_at` is read-only (backend controls it)

---

## 10. IMPORTANT FRONTEND CONSTRAINTS

1. **All IDs are UUIDs** (strings). Never use integer IDs.

2. **Bearer Token Header**: All authenticated requests must include `Authorization: Bearer <access_token>`.

3. **Token expiry**: Access token is valid for only **15 minutes**. The frontend must use the refresh token (`POST /api/v1/auth/refresh/`) to get a new access token before it expires. Use Axios interceptors to handle 401 errors and auto-refresh.

4. **Pagination is always present** on list endpoints. Never expect a plain array from a list endpoint. Always read `.results`, `.count`, `.next`, `.previous`.

5. **Default page size is 20**, max is 100. Use `?page_size=N&page=P` to paginate.

6. **Nested objects on creation**: When creating an `Inspection`, matches are nested inside the same POST body (`"matches": [...]`). The response after creation uses `InspectionSerializer` (not `InspectionCreateSerializer`) — so matches come back under `"matches"` array.

7. **Foreign key write format**: When writing FK fields in POST/PUT/PATCH, use the **UUID string** of the referenced object (e.g., `"device": "uuid-string"`, `"inference_index": "uuid-string"`).

8. **`reviewer` can be omitted** on Review creation — the backend will assign the current authenticated user as reviewer automatically.

9. **`corrected_disease` is mandatory when `decision == "corrected"`**. Never allow the form to submit with decision=corrected and no disease selected.

10. **Inspection organ_type must match InferenceIndex organ_type**. Frontend should enforce this by filtering available indexes based on the selected organ_type.

11. **Review is OneToOne with Inspection**. An inspection that already has a review cannot receive a second one. The frontend should check for existing review before showing the "Create Review" button.

12. **`is_active` boolean filter**: Send as `"true"` or `"false"` strings in query params (e.g., `?is_active=true`). The backend converts them.

13. **`matches[].rank_order` is 1-based**. If you send it, it must be ≥ 1. Duplicate rank_order within the same inspection creation is rejected.

14. **`threshold_default` on InferenceIndex** must be between 0 and 1.

15. **`similarity_score` and `confidence_score`** must be between 0 and 1.

16. **All datetime fields** are ISO 8601 format with timezone (e.g., `"2024-01-01T10:00:00Z"`).

17. **Search** is performed across specific fields per viewset (not all fields). See `search_fields` per viewset above.

18. **`extra_metadata`** on Inspection is a free-form JSON object (default: `{}`).

19. **`metadata_json`** on InspectionMatch is a free-form JSON object (default: `{}`).

20. **Vectors app has NO public API**. Do not attempt to call any vectors endpoint.

21. **Notifications app has NO public API**. No endpoints exist yet.

22. **DRF Router trailing slash**: All URLs have a trailing slash. Axios base URLs must be configured accordingly.

---

## 11. SEED DATA (For Development/Testing Reference)

Created by `python manage.py seed_demo_data`:

| Entity | Values |
|--------|--------|
| Admin login | username: `admin`, password: `admin1234` |
| Roles | `admin`, `operator` |
| Sources | 1 Site, 1 Greenhouse, 1 Zone, 1 Device |
| Diseases | `Early Blight`, `Late Blight`, `Healthy` |
| ModelVersion | one entry |
| InferenceIndexes | `fruit-demo-index` (organ: fruit), `leaf-demo-index` (organ: leaf) |
