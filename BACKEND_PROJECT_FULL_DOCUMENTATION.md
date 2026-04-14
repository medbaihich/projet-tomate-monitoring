# Backend Project Full Documentation

## 1. Purpose of This Document

This document explains the backend project from the beginning of the setup until the current state of the codebase.

It is written to serve three goals:

1. Explain what was built step by step.
2. Summarize the backend architecture and API clearly.
3. Describe the database structure and how all apps relate to each other.

This is intentionally detailed so it can be used as:

- a project handover document
- a learning document for someone new to the backend
- a practical reference for the database and API

## 2. Project Overview

This backend is a Django modular monolith built for a plant inspection platform.

The system stores:

- users and roles
- deployment hierarchy of physical devices
- disease knowledge base data
- inference metadata about prepared AI assets
- inspection business events
- inspection candidate matches
- human review decisions
- optional stored embeddings for future analysis

The backend does **not** currently implement:

- MQTT
- RabbitMQ
- Celery
- WebSockets
- FAISS execution in Django
- feature extraction in Django
- model training in Django

The backend is focused on:

- data modeling
- clean API endpoints
- admin usability
- local development readiness
- simple service-layer business logic

## 3. Stack and Main Technical Choices

The backend uses:

- Django
- Django REST Framework
- PostgreSQL
- Simple JWT for authentication

Main design choices:

- modular monolith instead of microservices
- one Django project with multiple domain apps
- UUID primary keys for domain entities
- shared abstract base models in `core`
- thin API views where business logic matters
- service-layer functions for complex create flows
- simple, readable serializers and CRUD endpoints

## 4. What Was Built, Step by Step

### 4.1 Initial Project Skeleton

The backend started as an empty repository.

The first foundation work included:

- creating the Django project structure
- adding the `config` project package
- creating the required app skeletons
- wiring all apps into `INSTALLED_APPS`
- preparing the project for local execution
- adding PostgreSQL support
- adding Django REST Framework
- adding environment helper support

The required apps created were:

- `core`
- `accounts`
- `devices`
- `catalog`
- `inference`
- `inspections`
- `vectors`
- `review`
- `notifications`

### 4.2 Core App

The `core` app was built to hold reusable shared foundations.

It contains abstract base models so other apps can inherit common fields without creating concrete `core` tables.

Implemented shared abstract models:

- `UUIDPrimaryKeyModel`
- `TimeStampedModel`

What they provide:

- `UUIDPrimaryKeyModel`: UUID-based `id`
- `TimeStampedModel`: `created_at` and `updated_at`

This keeps the rest of the project consistent and avoids repeating common fields.

### 4.3 Accounts App

The `accounts` app handles authentication and simple RBAC.

Implemented models:

- `Role`
- `User` as a custom Django user model

Relationship:

- one `Role` can be assigned to many users
- one `User` belongs to one role for now

Admin support was added so roles and users can be managed in Django admin.

The project was configured to use:

- `AUTH_USER_MODEL = "accounts.User"`

### 4.4 JWT Authentication

JWT authentication was added using DRF Simple JWT.

Implemented endpoints:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `GET /api/v1/auth/me/`

Purpose of each endpoint:

- `login`: issue access and refresh tokens
- `refresh`: issue a new access token
- `me`: return the currently authenticated user

This prepares the backend for token-based frontend or mobile integration later.

### 4.5 Catalog App

The `catalog` app is the disease knowledge base.

Implemented models:

- `Disease`
- `DiseaseCause`
- `DiseaseTreatment`
- `DiseaseResource`

Design:

- `Disease` is the central entity
- the other three models are child records linked to a disease

This app stores structured disease reference data for use across the system.

### 4.6 Devices App

The `devices` app stores the physical deployment hierarchy.

Implemented hierarchy:

- `Site`
- `Greenhouse`
- `Zone`
- `Device`

Relationship chain:

- a site contains many greenhouses
- a greenhouse belongs to a site
- a greenhouse contains many zones
- a zone belongs to a greenhouse
- a zone contains many devices
- a device belongs to a zone

This design keeps deployment data normalized and easy to query.

### 4.7 Inference App

The `inference` app stores metadata about AI assets that already exist outside Django.

Important architectural rule:

- this app does **not** execute machine learning
- this app does **not** build FAISS indexes
- this app does **not** extract embeddings

Implemented models:

- `ModelVersion`
- `InferenceIndex`

This app represents:

- a model version used for inference
- one or more prepared index resources linked to that model version

The design supports separate organ-specific resources like:

- leaf index
- fruit index

### 4.8 Inspections App

The `inspections` app stores business events.

It was intentionally kept separate from the inference asset definitions.

Implemented models:

- `Inspection`
- `InspectionMatch`

`Inspection` represents a real event in the business domain.

Examples:

- a device captured a leaf image
- the backend received a message tied to that event
- a chosen inference index was used for that event

`InspectionMatch` represents candidate similarity results attached to one inspection.

Examples:

- top match
- second candidate
- third candidate

This separation keeps the design clear:

- `InferenceIndex` = AI asset metadata
- `Inspection` = business event
- `InspectionMatch` = result candidates for that event

### 4.9 Vectors App

The `vectors` app is optional and minimal.

It stores selected embeddings only when needed.

Implemented model:

- `EmbeddingRecord`

This app was designed to remain decoupled from the main inspection flow.

It is useful for:

- retraining support later
- diagnostics
- offline analysis

It does not expose a public CRUD API.

### 4.10 Review App

The `review` app handles human validation.

Implemented model:

- `Review`

This app allows an operator or admin to:

- accept an inspection result
- correct an inspection result
- reject an inspection result

This keeps human review separate from machine-generated candidate matches.

### 4.11 API Polishing

After the main apps existed, the API layer was cleaned up.

Improvements included:

- consistent API versioning under `/api/v1/`
- pagination for list endpoints
- filtering support for useful query parameters
- clearer permissions
- better serializer validation
- OpenAPI schema endpoint

Global API behavior:

- JWT authentication by default
- authenticated access by default
- search support
- ordering support
- paginated list responses

### 4.12 Service Layer Work

To keep business logic out of views, service-layer functions were added.

Implemented services:

- `apps.inspections.services.create_inspection_with_matches`
- `apps.review.services.create_review`

This keeps views thinner and makes core business flows easier to test and understand.

### 4.13 Demo Seed Command

A management command was added to simplify local testing.

Command:

```bash
python manage.py seed_demo_data
```

It creates a small minimal dataset if missing:

- roles
- admin user
- site
- greenhouse
- zone
- device
- sample diseases
- model version
- fruit inference index
- leaf inference index

It is idempotent where possible, so it can be run repeatedly.

### 4.14 Automated Tests

Basic automated tests were added for the happy path.

Current tests cover:

- demo seed command behavior
- inspection creation with nested matches
- review creation

The goal was not a large test suite, but a practical foundation around the most important flows.

## 5. Current Project Structure

High-level structure:

```text
backend/
├── apps/
│   ├── accounts/
│   ├── catalog/
│   ├── core/
│   ├── devices/
│   ├── inference/
│   ├── inspections/
│   ├── notifications/
│   ├── review/
│   └── vectors/
├── config/
├── ai_assets/
├── manage.py
├── requirements.txt
├── README.md
└── docker-compose.yaml
```

Meaning of the major folders:

- `apps/`: all domain apps
- `config/`: Django project settings and URL configuration
- `ai_assets/`: external AI-related scripts and metadata assets, separate from backend runtime

## 6. Configuration Summary

### 6.1 Django Settings

The project uses:

- custom user model
- DRF
- Simple JWT
- PostgreSQL

Important settings in the current codebase:

- `AUTH_USER_MODEL = "accounts.User"`
- default authentication = JWT
- default permission = authenticated users
- default pagination = page number pagination
- schema generation = OpenAPI

### 6.2 Environment Helpers

The project includes environment helper functions in `config/env.py`.

These helpers support:

- string environment variables
- booleans
- integers
- comma-separated lists

They are used for settings like:

- secret key
- debug mode
- allowed hosts
- page size

### 6.3 Database Configuration

The backend is configured for PostgreSQL.

Current codebase note:

- some settings use environment helpers
- the database connection block is currently hardcoded in `config/settings.py`

Current database values in code:

- database name: `tomato_db`
- database user: `tomato_user`
- database password: `tomato_pass`
- host: `localhost`
- port: `5432`

This works for local development, but it is important to know that the database config is not fully environment-driven yet.

## 7. Shared Backend Conventions

### 7.1 Primary Keys

Most domain entities use UUID primary keys through the shared core base model.

Benefits:

- safer public identifiers
- easier merging of distributed data later
- more consistent modern API design

### 7.2 Timestamps

Most domain entities inherit timestamp fields:

- `created_at`
- `updated_at`

This gives consistent auditing across the project.

### 7.3 Thin Views

The backend prefers:

- simple views
- validation in serializers
- complex creation logic in services when necessary

This is most visible in:

- inspections create flow
- review create flow

### 7.4 Global Pagination and Filtering

The `core.api` module provides:

- `StandardResultsSetPagination`
- `apply_query_filters`

These are reused across viewsets for consistency.

## 8. App-by-App Detailed Summary

## 8.1 Core App

Purpose:

- shared foundations for the whole backend

Main files:

- `models.py`
- `api.py`
- `views.py`
- `management/commands/seed_demo_data.py`
- `tests.py`

Key elements:

- abstract base models
- health endpoint support
- reusable pagination and filter helper
- demo seed command
- integration tests

Health endpoints:

- `/api/health/`
- `/api/v1/health/`

### Core Models

#### `UUIDPrimaryKeyModel`

Provides:

- `id` as UUID primary key

Abstract:

- yes

#### `TimeStampedModel`

Provides:

- `created_at`
- `updated_at`

Abstract:

- yes

## 8.2 Accounts App

Purpose:

- authentication
- role assignment
- user identity

### Accounts Models

#### `Role`

Fields:

- `id`
- `created_at`
- `updated_at`
- `name`
- `description`

Rules:

- `name` is unique

Use:

- simple RBAC anchor

#### `User`

Base:

- custom Django `AbstractUser`
- shared UUID and timestamps

Important field:

- `role` -> foreign key to `Role`

Notes:

- role is nullable
- this keeps early setup and admin flows simple

### Accounts API

Endpoints:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `GET /api/v1/auth/me/`

### Accounts Admin

Admin registration exists for:

- roles
- users

## 8.3 Devices App

Purpose:

- store the physical deployment hierarchy

### Devices Models

#### `Site`

Fields:

- `id`
- `created_at`
- `updated_at`
- `name`
- `location`

Rules:

- `name` is unique

#### `Greenhouse`

Fields:

- `id`
- `created_at`
- `updated_at`
- `site`
- `name`
- `description`

Rules:

- unique per `(site, name)`

#### `Zone`

Fields:

- `id`
- `created_at`
- `updated_at`
- `greenhouse`
- `name`
- `description`

Rules:

- unique per `(greenhouse, name)`

#### `Device`

Fields:

- `id`
- `created_at`
- `updated_at`
- `zone`
- `name`
- `identifier`
- `description`

Rules:

- `identifier` is unique globally
- `name` is unique per `(zone, name)`

### Devices API

CRUD endpoints exist for:

- sites
- greenhouses
- zones
- devices

The serializers return nested relationships for readability:

- site includes greenhouses
- greenhouse includes zones
- zone includes devices

## 8.4 Catalog App

Purpose:

- disease knowledge base

### Catalog Models

#### `Disease`

Fields:

- `id`
- `created_at`
- `updated_at`
- `name`
- `slug`
- `summary`
- `symptoms`
- `prevention`

Rules:

- `name` is unique
- `slug` is unique

#### `DiseaseCause`

Fields:

- `id`
- `created_at`
- `updated_at`
- `disease`
- `title`
- `description`

#### `DiseaseTreatment`

Fields:

- `id`
- `created_at`
- `updated_at`
- `disease`
- `title`
- `description`

#### `DiseaseResource`

Fields:

- `id`
- `created_at`
- `updated_at`
- `disease`
- `title`
- `url`
- `description`

### Catalog API

CRUD endpoints exist for:

- diseases
- disease causes
- disease treatments
- disease resources

`Disease` responses include nested:

- causes
- treatments
- resources

## 8.5 Inference App

Purpose:

- store metadata for external AI inference assets

This app stores metadata only.

It does not do:

- FAISS loading
- FAISS searching
- embedding extraction
- ML execution

### Inference Models

#### `ModelVersion`

Fields:

- `id`
- `created_at`
- `updated_at`
- `name`
- `version`
- `framework`
- `artifact_path`
- `checksum`
- `is_active`
- `notes`

Rules:

- unique per `(name, version)`

Use:

- identify a prepared model resource

#### `InferenceIndex`

Fields:

- `id`
- `created_at`
- `updated_at`
- `model_version`
- `name`
- `organ_type`
- `index_path`
- `metadata_path`
- `threshold_default`
- `top_k_default`
- `is_active`
- `loaded_at`
- `notes`

Rules:

- unique per `(model_version, organ_type, name)`

Organ types currently supported:

- `leaf`
- `fruit`

Use:

- register external index files and metadata CSV files in the backend database

### Inference API

CRUD endpoints exist for:

- model versions
- inference indexes

Filtering supports common fields such as:

- model version
- organ type
- active state
- name

## 8.6 Inspections App

Purpose:

- store business events
- store candidate similarity results for those events

### Inspections Models

#### `Inspection`

Fields:

- `id`
- `created_at`
- `updated_at`
- `device`
- `inference_index`
- `predicted_disease`
- `organ_type`
- `status`
- `processing_status`
- `source_message_id`
- `top1_label`
- `confidence_score`
- `captured_at`
- `received_at`
- `processed_at`
- `extra_metadata`

Relationships:

- belongs to one `Device`
- belongs to one `InferenceIndex`
- may point to one predicted `Disease`

Status choices:

- `new`
- `reviewed`
- `closed`

Processing status choices:

- `pending`
- `processing`
- `completed`
- `failed`

Important validation:

- inspection `organ_type` must match `InferenceIndex.organ_type`

#### `InspectionMatch`

Fields:

- `id`
- `created_at`
- `updated_at`
- `inspection`
- `disease`
- `rank_order`
- `matched_label`
- `similarity_score`
- `metadata_json`

Relationships:

- belongs to one `Inspection`
- may reference one candidate `Disease`

Rules:

- `rank_order` must be unique per inspection

### Inspections Service Layer

Main service:

- `create_inspection_with_matches`

Responsibilities:

- validate the referenced device
- validate the referenced inference index
- optionally resolve the predicted disease
- validate organ type consistency
- normalize match data
- create the inspection
- create related match records

Helpful behavior already included:

- can auto-link a disease by label in some cases
- can fill default rank order if missing
- rejects duplicate rank values

### Inspections API

Endpoints exist for:

- inspections
- inspection matches

Important create flow:

- one `POST` request can create an inspection and multiple nested `InspectionMatch` records

This makes the inspections API practical for ingestion or integration flows later.

## 8.7 Review App

Purpose:

- human validation of inspection results

### Review Model

#### `Review`

Fields:

- `id`
- `created_at`
- `updated_at`
- `inspection`
- `reviewer`
- `corrected_disease`
- `decision`
- `comments`
- `reviewed_at`

Relationships:

- one review belongs to one inspection
- one review may belong to one reviewer user
- one review may point to one corrected disease

Decision choices:

- `accepted`
- `corrected`
- `rejected`

Important rule:

- if the decision is `corrected`, a corrected disease must be provided

### Review Service Layer

Main service:

- `create_review`

Responsibilities:

- validate the referenced inspection
- validate the reviewer if present
- validate the corrected disease if present
- create the review

### Review API

CRUD endpoint exists for:

- reviews

Behavior:

- authenticated user can create a review
- reviewer can default to the current request user

## 8.8 Vectors App

Purpose:

- optional storage of embeddings

### Vectors Model

#### `EmbeddingRecord`

Fields:

- `id`
- `created_at`
- `updated_at`
- `model_version`
- `inspection`
- `label`
- `vector`
- `notes`

Relationships:

- belongs to one `ModelVersion`
- may belong to one `Inspection`

Design note:

- this is optional storage only
- normal inspection flow does not depend on this table

## 8.9 Notifications App

Purpose:

- reserved app stub for future notification-related work

Current state:

- app skeleton exists
- no meaningful business implementation yet

This app is intentionally present in the modular structure even though it is not active yet.

## 9. Database Relationship Summary

This section summarizes the full database design in plain language.

### 9.1 Identity and Access

- one `Role` has many `User`
- one `User` optionally belongs to one `Role`

### 9.2 Physical Deployment Hierarchy

- one `Site` has many `Greenhouse`
- one `Greenhouse` belongs to one `Site`
- one `Greenhouse` has many `Zone`
- one `Zone` belongs to one `Greenhouse`
- one `Zone` has many `Device`
- one `Device` belongs to one `Zone`

### 9.3 Disease Knowledge Base

- one `Disease` has many `DiseaseCause`
- one `Disease` has many `DiseaseTreatment`
- one `Disease` has many `DiseaseResource`

### 9.4 Inference Metadata

- one `ModelVersion` has many `InferenceIndex`

### 9.5 Inspection Flow

- one `Device` has many `Inspection`
- one `InferenceIndex` has many `Inspection`
- one `Disease` may be referenced as `Inspection.predicted_disease`
- one `Inspection` has many `InspectionMatch`
- one `Disease` may be referenced as `InspectionMatch.disease`

### 9.6 Human Review Flow

- one `Inspection` has one `Review`
- one `User` can review many inspections
- one `Disease` can be stored as a corrected disease in many reviews

### 9.7 Optional Embedding Storage

- one `ModelVersion` has many `EmbeddingRecord`
- one `Inspection` may have many `EmbeddingRecord`

## 10. API Summary

All main API routes are organized under `/api/v1/`.

### Core

- `GET /api/health/`
- `GET /api/v1/health/`
- `GET /api/v1/schema/`

### Accounts

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `GET /api/v1/auth/me/`

### Catalog

- `/api/v1/catalog/...`

### Devices

- `/api/v1/devices/...`

### Inference

- `/api/v1/inference/...`

### Inspections

- `/api/v1/inspections/...`

### Review

- `/api/v1/review/...`

General API behavior:

- authenticated by JWT unless explicitly opened
- paginated list responses
- search and ordering support on many endpoints
- lightweight query-param filtering on many viewsets

## 11. Admin Summary

Django admin support has been configured where useful.

Admin is available for:

- accounts
- devices
- catalog
- inference
- inspections
- review
- vectors

Benefits of the admin setup:

- quick local inspection of records
- manual data entry during development
- easier debugging
- no need to build frontend screens first

## 12. Demo Data Summary

The `seed_demo_data` command creates the minimum usable local dataset.

It creates:

- role `admin`
- role `operator`
- admin user `admin`
- one site
- one greenhouse
- one zone
- one device
- three diseases
- one model version
- one fruit index
- one leaf index

Admin credentials created by the command:

- username: `admin`
- password: `admin1234`

Seed diseases:

- Early Blight
- Late Blight
- Healthy

Seed indexes:

- `fruit-demo-index`
- `leaf-demo-index`

## 13. Automated Test Summary

Current automated tests focus on the main happy path.

Covered flows:

1. Running the demo seed command without creating duplicates.
2. Creating an inspection through the API.
3. Creating nested inspection matches in the same request.
4. Creating a review for the inspection.

This gives the backend a simple but meaningful regression safety net.

## 14. Important Design Principles Used in This Backend

### 14.1 Separation of Concerns

The system separates:

- user/auth concerns
- physical device hierarchy
- knowledge base data
- AI asset metadata
- business events
- human review decisions

This is one of the most important architectural strengths of the project.

### 14.2 Modular Monolith

The backend stays in one deployment unit, but domain boundaries are still clear through apps.

Benefits:

- easier early development
- simpler deployment
- clean domain organization
- easier future extraction if needed

### 14.3 Metadata-Only Inference Layer

The inference app deliberately stores metadata instead of runtime ML logic.

This avoids mixing:

- backend data management
- AI execution code

That separation keeps the backend simpler and more maintainable.

### 14.4 Business Events vs AI Assets

The project clearly separates:

- `InferenceIndex` and `ModelVersion` as resources
- `Inspection` and `InspectionMatch` as actual business events and results

This is a very important modeling decision and should be preserved.

### 14.5 Human-in-the-Loop Validation

The review app introduces a practical human validation layer without overcomplicating workflow logic.

This is a good middle ground:

- enough structure for real review
- not too heavy for an early-stage backend

## 15. Current Limitations and Notes

These are not necessarily bugs, but they are important project notes.

### 15.1 Database Settings

The backend includes environment helpers, but the database block is still hardcoded in the current settings file.

This is acceptable for local development, but should be kept in mind for deployment preparation.

### 15.2 Notifications App

The `notifications` app is still only a stub and has no real implementation yet.

### 15.3 Vectors API

The `vectors` app stores data but intentionally does not expose a public API right now.

### 15.4 No Async or Queue Pipeline

There is currently no:

- task queue
- event bus
- async ingestion pipeline
- websocket push mechanism

This is by design.

## 16. How to Work With the Project Locally

Typical local setup flow:

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver
```

Useful commands:

```bash
python manage.py check
python manage.py test apps.core
python manage.py createsuperuser
```

## 17. Suggested Mental Model for New Developers

If someone new joins this project, the easiest way to understand it is:

1. `accounts` tells you who is using the system.
2. `devices` tells you where the hardware is deployed.
3. `catalog` tells you what diseases exist in the knowledge base.
4. `inference` tells you which AI assets are available.
5. `inspections` tells you what happened in real operations.
6. `review` tells you what a human decided after seeing the result.
7. `vectors` stores optional embedding data for later use.

That mental model matches the database design very well.

## 18. Final Summary

The backend has moved from an empty repository to a clean modular Django backend with:

- project skeleton and settings
- reusable core base models
- custom authentication and JWT
- physical deployment hierarchy
- disease knowledge base
- inference metadata registry
- inspection event tracking
- candidate match storage
- human review flow
- optional embedding storage
- local demo seeding
- basic automated tests
- consistent API versioning and documentation support

In short, the backend is now a strong, practical foundation for the project.

It is simple enough to continue evolving safely, but already structured enough to support real development work.
