# Python Files and Models Reference

## 1. Purpose of This Document

This document explains:

- every important Python file in the project
- every Django model in the backend
- what each file does
- why each file is important

This is a file-by-file reference, not only a high-level summary.

It is meant to help someone understand the codebase without opening every file one by one.

## 2. How to Read This Document

Each file is explained with:

- what it contains
- what it is used for
- why it matters
- whether it is active, foundational, optional, placeholder, or historical

Model classes are explained separately inside the relevant app sections.

## 3. Root-Level Python Files

### `manage.py`

What it does:

- entry point for Django management commands
- sets `DJANGO_SETTINGS_MODULE` to `config.settings`
- runs commands like `runserver`, `migrate`, `check`, `test`, and custom commands

Why it is important:

- this is the standard operational entry point for the whole backend
- without it, local Django commands would not work normally

### `config/__init__.py`

What it does:

- marks `config` as a Python package

Why it is important:

- required so Django can import the configuration module correctly

## 4. Config Package

### `config/settings.py`

What it does:

- main Django settings file
- defines installed apps, middleware, database, authentication, static files, and DRF settings

Main responsibilities:

- registers all project apps
- enables DRF
- enables JWT authentication
- sets pagination
- sets global permissions
- configures PostgreSQL
- defines `AUTH_USER_MODEL`

Why it is important:

- this is the most central configuration file in the project
- all apps depend on it being correct

Current notable behavior:

- default authentication is JWT
- default API permission is authenticated access
- list endpoints are paginated
- schema generation is enabled

### `config/urls.py`

What it does:

- root URL router for the whole project

Main responsibilities:

- exposes admin URLs
- exposes health endpoints
- exposes OpenAPI schema endpoint
- includes all app API routes under `/api/v1/`

Why it is important:

- this is the API entry map for the project
- it defines the public route structure

### `config/env.py`

What it does:

- helper functions for environment variables

Functions included:

- `load_env_file`
- `env`
- `env_bool`
- `env_int`
- `env_list`

Why it is important:

- keeps settings cleaner
- makes configuration safer and easier to reuse
- supports `.env`-style local development

### `config/asgi.py`

What it does:

- exposes the ASGI application object

Why it is important:

- needed if the project is served through an ASGI server
- future-friendly even though the current backend does not use async features

### `config/wsgi.py`

What it does:

- exposes the WSGI application object

Why it is important:

- needed for classic Django deployment setups
- standard production/deployment support file

## 5. Apps Package

### `apps/__init__.py`

What it does:

- marks `apps` as a Python package

Why it is important:

- allows imports like `apps.accounts`, `apps.devices`, and so on

## 6. Core App

Purpose of the app:

- shared building blocks
- common API helpers
- health checks
- management commands
- basic integration tests

### `apps/core/__init__.py`

What it does:

- marks the app as a Python package

Why it is important:

- standard package initialization file

### `apps/core/apps.py`

What it does:

- defines `CoreConfig`

Why it is important:

- registers the app with Django
- gives the app a stable label: `core`

### `apps/core/models.py`

What it does:

- defines shared abstract base models

Why it is important:

- avoids repeating common fields in all apps
- gives the project consistent IDs and timestamps

#### Model: `UUIDPrimaryKeyModel`

What it does:

- provides `id` as a UUID primary key

Why it is important:

- standardizes object identifiers across the backend
- useful for API exposure and distributed-safe identifiers

Important note:

- abstract model
- does not create its own table

#### Model: `TimeStampedModel`

What it does:

- provides `created_at`
- provides `updated_at`

Why it is important:

- standardizes auditing fields across models

Important note:

- abstract model
- does not create its own table

### `apps/core/api.py`

What it does:

- contains API utility helpers shared across apps

Contents:

- `StandardResultsSetPagination`
- `apply_query_filters`

Why it is important:

- ensures a consistent list pagination format
- reduces repeated filtering code in viewsets

#### `StandardResultsSetPagination`

What it does:

- page-number pagination
- supports `page_size` query parameter
- caps page size at 100

Why it is important:

- makes API list responses safer and more consistent

#### `apply_query_filters`

What it does:

- reads query parameters
- applies simple exact filters dynamically
- converts common truthy and falsy strings to booleans

Why it is important:

- makes filtering easy to reuse
- keeps views smaller

### `apps/core/views.py`

What it does:

- defines health check API views

Classes:

- `HealthCheckView`
- `LegacyHealthCheckView`

Why it is important:

- provides a quick operational check that the backend is up

#### `HealthCheckView`

What it does:

- returns `{"status": "ok"}`
- open to unauthenticated access

#### `LegacyHealthCheckView`

What it does:

- reuses `HealthCheckView`
- hides itself from the schema

Why it is important:

- preserves backward compatibility for the older `/api/health/` route

### `apps/core/admin.py`

What it does:

- currently contains no admin registrations

Why it is important:

- reserved for future core admin items if needed

### `apps/core/tests.py`

What it does:

- contains the current integration-style backend tests

Why it is important:

- this is the most meaningful active test file in the project right now

Current test coverage:

- demo seed command idempotency
- inspection creation with nested matches
- review creation flow

### `apps/core/management/__init__.py`

What it does:

- marks the management package

Why it is important:

- required so Django can discover custom management commands

### `apps/core/management/commands/__init__.py`

What it does:

- marks the command package

Why it is important:

- required for Django command discovery

### `apps/core/management/commands/seed_demo_data.py`

What it does:

- custom management command to create minimal demo data

Why it is important:

- makes local testing fast
- gives a ready-to-use dataset for the main backend flows

Main responsibilities:

- create `admin` role
- create `operator` role
- create one admin user
- create one site, greenhouse, zone, and device
- create sample diseases
- create one model version
- create one fruit inference index
- create one leaf inference index

Important design detail:

- idempotent where possible using `get_or_create` and `update_or_create`

### `apps/core/migrations/__init__.py`

What it does:

- marks the migrations package

Why it is important:

- standard Django migration package file
- `core` has no concrete model migrations because its models are abstract

## 7. Accounts App

Purpose of the app:

- user management
- role assignment
- authentication endpoints

### `apps/accounts/__init__.py`

What it does:

- package marker

### `apps/accounts/apps.py`

What it does:

- defines `AccountsConfig`

Why it is important:

- registers the accounts app with Django

### `apps/accounts/models.py`

What it does:

- defines the authentication domain models

Why it is important:

- this app owns identity and role assignment

#### Model: `Role`

What it does:

- stores a simple role record

Fields:

- `id`
- `created_at`
- `updated_at`
- `name`
- `description`

Why it is important:

- provides a simple RBAC starting point

#### Model: `User`

What it does:

- custom Django user model

Inheritance:

- `UUIDPrimaryKeyModel`
- `TimeStampedModel`
- `AbstractUser`

Important field:

- `role`

Why it is important:

- custom user model is the base identity object of the whole system
- having it from the start avoids painful later replacement

### `apps/accounts/admin.py`

What it does:

- registers `Role` and `User` in Django admin

Why it is important:

- makes user and role management possible without a frontend

Key value of the file:

- extends `DjangoUserAdmin`
- exposes role on admin forms
- shows audit fields read-only

### `apps/accounts/serializers.py`

What it does:

- defines serializer logic for account-related API output

Current serializer:

- `CurrentUserSerializer`

Why it is important:

- controls how `/api/v1/auth/me/` responds

### `apps/accounts/views.py`

What it does:

- implements auth-related API views

Classes:

- `LoginView`
- `RefreshTokenView`
- `CurrentUserView`

Why it is important:

- these are the main authentication entry points for clients

### `apps/accounts/urls.py`

What it does:

- maps auth routes for the accounts app

Routes:

- `login/`
- `refresh/`
- `me/`

Why it is important:

- exposes JWT auth behavior cleanly under `/api/v1/auth/`

### `apps/accounts/tests.py`

What it does:

- placeholder test file created by Django

Why it is important:

- currently low importance
- reserved for future account-specific tests

### `apps/accounts/migrations/__init__.py`

What it does:

- package marker for migrations

### `apps/accounts/migrations/0001_initial.py`

What it does:

- creates the initial accounts schema

What it creates:

- `Role`
- custom `User`

Why it is important:

- foundational migration for authentication and admin access

## 8. Devices App

Purpose of the app:

- physical deployment hierarchy

### `apps/devices/__init__.py`

What it does:

- package marker

### `apps/devices/apps.py`

What it does:

- defines `DevicesConfig`

### `apps/devices/models.py`

What it does:

- defines the physical hierarchy models

Why it is important:

- this app anchors where inspections come from in the real world

#### Model: `Site`

What it does:

- top-level deployment location

#### Model: `Greenhouse`

What it does:

- sub-location under a site

Why it is important:

- groups zones within a given site

#### Model: `Zone`

What it does:

- sub-area inside a greenhouse

Why it is important:

- narrows the physical context of devices

#### Model: `Device`

What it does:

- physical device record

Important fields:

- `zone`
- `name`
- `identifier`
- `description`

Why it is important:

- inspections belong to a device
- this makes devices essential to the business event model

### `apps/devices/serializers.py`

What it does:

- converts device hierarchy models to and from API data

Why it is important:

- exposes nested structure for easier frontend consumption

Serializers:

- `SiteSerializer`
- `GreenhouseSerializer`
- `ZoneSerializer`
- `DeviceSerializer`

### `apps/devices/views.py`

What it does:

- implements CRUD viewsets for the device hierarchy

Why it is important:

- this is the API layer for deployment management

Key features:

- authenticated access
- search support
- ordering support
- simple filters by parent IDs

### `apps/devices/urls.py`

What it does:

- registers device-related routers

Why it is important:

- exposes `/sites/`, `/greenhouses/`, `/zones/`, and `/devices/`

### `apps/devices/admin.py`

What it does:

- registers all hierarchy models in admin
- uses inlines to show child records within parent records

Why it is important:

- makes the hierarchy much easier to manage manually

### `apps/devices/tests.py`

What it does:

- placeholder test file

Why it is important:

- reserved for future device-specific tests

### `apps/devices/migrations/__init__.py`

What it does:

- migration package marker

### `apps/devices/migrations/0001_initial.py`

What it does:

- creates the initial device hierarchy schema

What it creates:

- `Site`
- `Greenhouse`
- `Zone`
- `Device`

Important schema details:

- unique greenhouse name per site
- unique zone name per greenhouse
- unique device name per zone
- globally unique device identifier

## 9. Catalog App

Purpose of the app:

- disease knowledge base

### `apps/catalog/__init__.py`

What it does:

- package marker

### `apps/catalog/apps.py`

What it does:

- defines `CatalogConfig`

### `apps/catalog/models.py`

What it does:

- defines the disease knowledge base models

Why it is important:

- this app is the shared disease reference layer for inference results and reviews

#### Model: `Disease`

What it does:

- central disease entity

Why it is important:

- referenced by inspections, matches, and reviews

#### Model: `DiseaseCause`

What it does:

- stores causes linked to a disease

#### Model: `DiseaseTreatment`

What it does:

- stores treatments linked to a disease

#### Model: `DiseaseResource`

What it does:

- stores URLs and references linked to a disease

### `apps/catalog/serializers.py`

What it does:

- serializes disease models

Why it is important:

- nested disease responses make the API practical for UI use

### `apps/catalog/views.py`

What it does:

- CRUD API viewsets for disease models

Why it is important:

- exposes the knowledge base over the API

### `apps/catalog/urls.py`

What it does:

- maps routers for disease endpoints

### `apps/catalog/admin.py`

What it does:

- admin configuration for all disease models
- uses inlines for disease child records

Why it is important:

- makes disease maintenance easier in the admin

### `apps/catalog/tests.py`

What it does:

- placeholder test file

### `apps/catalog/migrations/__init__.py`

What it does:

- migration package marker

### `apps/catalog/migrations/0001_initial.py`

What it does:

- creates the initial disease knowledge base schema

What it creates:

- `Disease`
- `DiseaseCause`
- `DiseaseTreatment`
- `DiseaseResource`

## 10. Inference App

Purpose of the app:

- metadata registry for external inference assets

### `apps/inference/__init__.py`

What it does:

- package marker

### `apps/inference/apps.py`

What it does:

- defines `InferenceConfig`

### `apps/inference/models.py`

What it does:

- defines inference metadata models

Why it is important:

- this app tells the backend which model and index resources exist

#### Model: `ModelVersion`

What it does:

- stores metadata for a prepared model version

Why it is important:

- acts as the parent object for inference indexes and optional embeddings

#### Model: `InferenceIndex`

What it does:

- stores metadata for a prepared index

Important fields:

- `model_version`
- `name`
- `organ_type`
- `index_path`
- `metadata_path`
- `threshold_default`
- `top_k_default`
- `is_active`
- `loaded_at`

Why it is important:

- inspections link to it
- it represents the selected AI resource without executing AI logic

### `apps/inference/serializers.py`

What it does:

- serializes model versions and inference indexes

Why it is important:

- validates fields like `threshold_default`
- includes nested indexes on model version responses

### `apps/inference/views.py`

What it does:

- CRUD API for model versions and indexes

Why it is important:

- allows the backend to register leaf and fruit indexes in the database

### `apps/inference/urls.py`

What it does:

- router mapping for inference endpoints

### `apps/inference/admin.py`

What it does:

- admin registration for model versions and indexes
- shows indexes inline inside a model version

### `apps/inference/tests.py`

What it does:

- placeholder test file

### `apps/inference/migrations/__init__.py`

What it does:

- migration package marker

### `apps/inference/migrations/0001_initial.py`

What it does:

- creates the first inference schema version

Historical note:

- this first version used older index metadata fields such as backend, similarity metric, dimension, item count, and artifact path

Why it is important:

- shows the original design before the inference metadata model was refined

### `apps/inference/migrations/0002_remove_inferenceindex_unique_index_name_per_model_version_and_more.py`

What it does:

- updates `InferenceIndex` to the current design

Changes introduced:

- removes older generic index fields
- adds `organ_type`
- adds `index_path`
- adds `metadata_path`
- adds `threshold_default`
- adds `top_k_default`
- adds `loaded_at`
- changes uniqueness to `(model_version, organ_type, name)`

Why it is important:

- aligns the schema with the project’s leaf and fruit asset setup

## 11. Inspections App

Purpose of the app:

- business events and candidate results

### `apps/inspections/__init__.py`

What it does:

- package marker

### `apps/inspections/apps.py`

What it does:

- defines `InspectionsConfig`

### `apps/inspections/models.py`

What it does:

- defines inspection event models

Why it is important:

- this is one of the central business-domain apps in the backend

#### Model: `Inspection`

What it does:

- stores one inspection event

Important relationships:

- belongs to one `Device`
- belongs to one `InferenceIndex`
- may reference one predicted `Disease`

Important fields:

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

Important validation:

- `clean()` checks that the selected `InferenceIndex.organ_type` matches the `Inspection.organ_type`

Why it is important:

- this model records the actual operational event in the system

#### Model: `InspectionMatch`

What it does:

- stores one candidate result linked to an inspection

Important fields:

- `rank_order`
- `matched_label`
- `similarity_score`
- `metadata_json`

Why it is important:

- lets the system keep multiple candidate matches instead of only the top result

### `apps/inspections/serializers.py`

What it does:

- serializes inspections and matches
- supports nested inspection creation

Why it is important:

- this file is what makes one POST request create an inspection and multiple matches

Main serializers:

- `InspectionSerializer`
- `InspectionMatchSerializer`
- `InspectionCreateSerializer`
- `InspectionMatchCreateSerializer`

### `apps/inspections/services.py`

What it does:

- service-layer business logic for inspection creation

Main function:

- `create_inspection_with_matches`

Why it is important:

- keeps business logic out of the view
- validates references before object creation
- creates `Inspection` and `InspectionMatch` records in one transaction

Helper behavior:

- validates device existence
- validates inference index existence
- can resolve diseases from labels
- normalizes nested match data

### `apps/inspections/views.py`

What it does:

- API views for inspections and inspection matches

Why it is important:

- thin API layer over the inspection domain
- create action delegates to the service layer

### `apps/inspections/urls.py`

What it does:

- router mapping for:
  - inspections
  - inspection matches

### `apps/inspections/admin.py`

What it does:

- admin registration for inspections and matches
- shows matches inline under inspections

### `apps/inspections/tests.py`

What it does:

- placeholder test file

Why it is important:

- future home for inspection-specific tests if the test suite grows

### `apps/inspections/migrations/__init__.py`

What it does:

- migration package marker

### `apps/inspections/migrations/0001_initial.py`

What it does:

- creates the inspection schema

What it creates:

- `Inspection`
- `InspectionMatch`

Important note:

- depends on `catalog`, `devices`, and the initial `inference` migration

Why it is important:

- this migration establishes the main business event tables

## 12. Review App

Purpose of the app:

- human validation of inspection outcomes

### `apps/review/__init__.py`

What it does:

- package marker

### `apps/review/apps.py`

What it does:

- defines `ReviewConfig`

### `apps/review/models.py`

What it does:

- defines the review model

Why it is important:

- adds a human-in-the-loop layer to the system

#### Model: `Review`

What it does:

- stores a human decision about an inspection

Important relationships:

- one-to-one with `Inspection`
- optional foreign key to `User`
- optional foreign key to `Disease` as corrected disease

Decision options:

- `accepted`
- `corrected`
- `rejected`

Why it is important:

- allows human validation without a complicated workflow engine

### `apps/review/serializers.py`

What it does:

- serializes reviews
- validates corrected review behavior

Why it is important:

- enforces that `corrected_disease` must exist when decision is `corrected`

### `apps/review/services.py`

What it does:

- service-layer logic for review creation

Main function:

- `create_review`

Why it is important:

- keeps reference validation out of the view
- keeps the create flow cleaner and easier to maintain

### `apps/review/views.py`

What it does:

- CRUD API for reviews

Why it is important:

- view remains thin
- creation uses the review service
- update flow automatically refreshes `reviewed_at`

### `apps/review/urls.py`

What it does:

- router mapping for review endpoints

### `apps/review/admin.py`

What it does:

- registers `Review` in admin

Why it is important:

- makes manual review inspection easy during development

### `apps/review/tests.py`

What it does:

- placeholder test file

### `apps/review/migrations/__init__.py`

What it does:

- migration package marker

### `apps/review/migrations/0001_initial.py`

What it does:

- creates the `Review` table

Why it is important:

- establishes the human validation layer in the schema

## 13. Vectors App

Purpose of the app:

- optional embedding storage

### `apps/vectors/__init__.py`

What it does:

- package marker

### `apps/vectors/apps.py`

What it does:

- defines `VectorsConfig`

### `apps/vectors/models.py`

What it does:

- defines `EmbeddingRecord`

Why it is important:

- gives the backend a place to store selected embeddings without making that mandatory in the main flow

#### Model: `EmbeddingRecord`

What it does:

- stores one embedding vector and related metadata

Important relationships:

- belongs to a `ModelVersion`
- may belong to an `Inspection`

Important fields:

- `label`
- `vector`
- `notes`

Why it is important:

- useful for future retraining or offline analysis
- stays optional

### `apps/vectors/admin.py`

What it does:

- admin registration for `EmbeddingRecord`

Why it is important:

- enables manual inspection of stored embeddings

### `apps/vectors/views.py`

What it does:

- Django-generated placeholder view file

Current status:

- not used by the backend API

Why it is important:

- low current importance
- reminds us the app has no public API yet

### `apps/vectors/tests.py`

What it does:

- placeholder test file

### `apps/vectors/migrations/__init__.py`

What it does:

- migration package marker

### `apps/vectors/migrations/0001_initial.py`

What it does:

- creates the `EmbeddingRecord` table

Why it is important:

- adds optional vector persistence to the schema

## 14. Notifications App

Purpose of the app:

- reserved app for future notification features

Current status:

- mostly scaffold only

### `apps/notifications/__init__.py`

What it does:

- package marker

### `apps/notifications/apps.py`

What it does:

- defines `NotificationsConfig`

Why it is important:

- keeps the app registered and ready for future work

### `apps/notifications/models.py`

What it does:

- currently only imports `models`
- contains no real model definitions yet

Why it is important:

- placeholder for future notification-related tables

### `apps/notifications/views.py`

What it does:

- placeholder file created by Django

Current status:

- not active

### `apps/notifications/admin.py`

What it does:

- placeholder admin file

Current status:

- no registrations yet

### `apps/notifications/tests.py`

What it does:

- placeholder test file

### `apps/notifications/migrations/__init__.py`

What it does:

- migration package marker

Why it is important:

- even a placeholder app should have a clean Django structure

## 15. AI Assets Scripts

Purpose of this folder:

- data preparation and offline AI asset generation outside the Django runtime

Important note:

- these scripts are not part of the Django request-response path
- they support the external asset pipeline

### `ai_assets/scripts/config.py`

What it does:

- central config file for the AI asset scripts

Contents:

- dataset paths
- metadata paths
- embeddings paths
- FAISS index paths
- label normalization rules
- organ detection rules
- source definitions

Why it is important:

- this is the backbone for all the offline data-processing scripts

### `ai_assets/scripts/build_master_metadata.py`

What it does:

- scans raw datasets
- normalizes labels
- identifies organ type
- parses folder-based and YOLO-style datasets
- creates `master_metadata.csv`

Why it is important:

- this is the first major unification step of the external dataset pipeline

### `ai_assets/scripts/review_metadata.py`

What it does:

- prints summaries of the master metadata

Why it is important:

- lightweight inspection tool for the metadata dataset before further processing

### `ai_assets/scripts/build_final_dataset.py`

What it does:

- builds the cleaned final dataset
- copies uncropped images
- crops bounding-box-based images
- creates `final_metadata.csv`

Why it is important:

- bridges raw metadata and actual training/search-ready image outputs

### `ai_assets/scripts/extract_embeddings.py`

What it does:

- loads the final dataset
- uses MobileNetV2 to extract embeddings
- normalizes embeddings
- saves `.npy` embedding matrices
- saves organ-specific metadata CSV files

Why it is important:

- this is the embedding-generation step that happens outside the backend

### `ai_assets/scripts/build_faiss.py`

What it does:

- loads organ-specific embeddings
- creates FAISS indexes
- writes the index files to disk

Why it is important:

- this is how the fruit and leaf FAISS indexes are built before being registered in Django

### `ai_assets/scripts/search_query.py`

What it does:

- command-line similarity search tool
- loads the appropriate FAISS index
- extracts an embedding for a query image
- searches the index
- prints ranked matches

Why it is important:

- useful for offline experimentation and validation outside the backend API

## 16. Package Marker Files

Many `__init__.py` files exist across the project.

What they do:

- tell Python that a folder is a package

Why they are important:

- imports would break without them
- Django app discovery and migration discovery depend on these package boundaries

Even though they often contain no code, they are still structurally important.

## 17. Placeholder Files

Some files still contain Django-generated placeholder content.

Examples:

- `apps/notifications/models.py`
- `apps/notifications/views.py`
- `apps/notifications/admin.py`
- many `tests.py` files outside `core`
- `apps/vectors/views.py`

Why they matter:

- they show future extension points
- they preserve a clean, standard Django app structure

Why they are low importance right now:

- they do not hold active business logic yet

## 18. Most Important Files in the Whole Project

If someone only reads a small number of files first, these are the most valuable ones:

1. `config/settings.py`
2. `config/urls.py`
3. `apps/core/models.py`
4. `apps/accounts/models.py`
5. `apps/devices/models.py`
6. `apps/catalog/models.py`
7. `apps/inference/models.py`
8. `apps/inspections/models.py`
9. `apps/inspections/services.py`
10. `apps/review/models.py`
11. `apps/review/services.py`
12. `apps/core/management/commands/seed_demo_data.py`
13. `apps/core/tests.py`

These files explain most of the project’s architecture, database design, and main business flows.

## 19. Most Important Models in the Whole Project

If someone wants to understand the database quickly, these are the key models:

1. `User`
2. `Role`
3. `Site`
4. `Greenhouse`
5. `Zone`
6. `Device`
7. `Disease`
8. `ModelVersion`
9. `InferenceIndex`
10. `Inspection`
11. `InspectionMatch`
12. `Review`
13. `EmbeddingRecord`

Together they describe nearly the full operational data model of the backend.

## 20. Final Summary

This codebase is organized clearly:

- `config` controls the project
- `core` provides shared foundations
- `accounts` handles identity
- `devices` handles physical hierarchy
- `catalog` handles disease knowledge
- `inference` handles AI asset metadata
- `inspections` handles business events and candidate matches
- `review` handles human validation
- `vectors` handles optional embedding storage
- `notifications` is prepared for future work
- `ai_assets/scripts` handles offline asset preparation outside Django

The project is already in a good shape for continued development because the files are separated by responsibility and the most important logic is concentrated in the right places.
